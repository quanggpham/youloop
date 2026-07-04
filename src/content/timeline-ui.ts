export interface TimelineUI {
  inject(container: HTMLElement): void;
  destroy(): void;
  updateMarkers(start: number, end: number): void;
  setActive(active: boolean): void;
  onSetStart(cb: (time: number) => void): () => void;
  onSetEnd(cb: (time: number) => void): () => void;
  onToggleLoop(cb: () => void): () => void;
  onDragMarker(type: 'start' | 'end', cb: (time: number) => void): () => void;
}

const YT_RED = 'rgb(255, 0, 0)';
const YT_WHITE = '#FFFFFF';
const YT_BG = 'rgba(0, 0, 0, 0.8)';

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type MarkerType = 'start' | 'end';

export function createTimelineUI(): TimelineUI {
  let container: HTMLElement | null = null;
  let elements: HTMLElement[] = [];
  let toggleBtn: HTMLElement | null = null;
  let timeDisplayEl: HTMLElement | null = null;
  let oldOverflows: Array<{ el: HTMLElement; overflow: string }> = [];
  let markersEl: HTMLElement[] = []; // [startMarker, endMarker, region]
  let autohideObserver: MutationObserver | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let currentPoints: { start: number; end: number } | null = null;
  let repositionTimer: ReturnType<typeof setTimeout> | null = null;
  const callbacks = {
    setStart: new Set<(t: number) => void>(),
    setEnd: new Set<(t: number) => void>(),
    toggleLoop: new Set<() => void>(),
    dragMarker: new Set<(type: MarkerType, t: number) => void>(),
  };

  let activeDrag: {
    type: MarkerType;
    marker: HTMLElement;
    onUp: () => void;
  } | null = null;

  function getTimeSource(): number {
    const video = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
    return video?.currentTime ?? 0;
  }

  function getVideoDuration(): number {
    const video = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
    return video?.duration ?? 0;
  }

  function getProgressBar(): HTMLElement | null {
    if (!container) return null;
    return document.querySelector('.ytp-progress-bar') as HTMLElement | null
      || container.querySelector('.ytp-progress-bar') as HTMLElement | null;
  }

  // Remove overflow:hidden from ancestors so tall markers render outside the bar
  function patchOverflows(): void {
    if (!container) return;
    let el: HTMLElement | null = container;
    while (el && el !== document.body) {
      const s = getComputedStyle(el);
      if (s.overflow === 'hidden' || s.overflowX === 'hidden' || s.overflowY === 'hidden') {
        oldOverflows.push({ el, overflow: el.style.overflow || '' });
        el.style.overflow = 'visible';
      }
      el = el.parentElement;
    }
  }

  function restoreOverflows(): void {
    oldOverflows.forEach(({ el, overflow }) => {
      el.style.overflow = overflow;
    });
    oldOverflows = [];
  }

  // ── Controls — YouTube-native SVG icon buttons ────────────────────
  // Use .ytp-button class so YouTube's own CSS handles alignment,
  // sizing, hover states, and auto-hide behavior — our buttons blend
  // in as if they were native controls.
  //   - 48×48 touch target
  //   - 24×24 SVG icon centered inside button
  //   - opacity handled by YouTube's .ytp-button:hover rules

  function makeSvgIcon(svgContent: string): SVGElement {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) throw new Error('Invalid SVG');
    return svg;
  }

  function makeYtButton(opts: {
    action: string;
    title: string;
    ariaLabel: string;
    icon: SVGElement;
  }): HTMLElement {
    const btn = document.createElement('button');
    btn.setAttribute('data-svl-button', '');
    btn.setAttribute('data-svl-action', opts.action);
    btn.setAttribute('aria-label', opts.ariaLabel);
    btn.title = opts.title;
    btn.classList.add('ytp-button');
    btn.style.cssText = '-webkit-app-region:no-drag;';
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.9'; });
    btn.addEventListener('focus', () => { btn.style.opacity = '1'; });
    btn.addEventListener('blur', () => { btn.style.opacity = '0.9'; });

    opts.icon.style.cssText = `
      width:24px;height:24px;fill:${YT_WHITE};
      pointer-events:none;display:block;margin:auto;
    `;
    btn.appendChild(opts.icon);
    return btn;
  }

  // SVG icons — 28×28 viewBox
  const ICONS = {
    // Filled loop icon — thick arcs like YouTube's native icons
    loop: makeSvgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">
      <path d="M6 14a8 8 0 018-8c2.6 0 5 1.3 6.5 3.5l-2.5 2.5h6v-6l-2 2A10 10 0 0014 4C8.5 4 4 8.5 4 14h2z" fill="#FFF"/>
      <path d="M22 14a8 8 0 01-8 8c-2.6 0-5-1.3-6.5-3.5l2.5-2.5H4v6l2-2a10 10 0 0016-6h-2z" fill="#FFF"/>
    </svg>`),

    // [A — bracket [ at left (opens right → into range), letter A at right
    flagStart: makeSvgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">
      <path d="M6 8v12" stroke="#FFF" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M6 8h5" stroke="#FFF" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M6 20h5" stroke="#FFF" stroke-width="3" fill="none" stroke-linecap="round"/>
      <text x="18" y="19.5" text-anchor="middle" font-size="12" font-weight="700" fill="#FFF" font-family="YouTube Sans,Roboto,Arial,sans-serif">A</text>
    </svg>`),

    // B] — letter B at left, bracket ] at right (opens left ← into range)
    flagEnd: makeSvgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">
      <path d="M22 8v12" stroke="#FFF" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M22 8h-5" stroke="#FFF" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M22 20h-5" stroke="#FFF" stroke-width="3" fill="none" stroke-linecap="round"/>
      <text x="10" y="19.5" text-anchor="middle" font-size="12" font-weight="700" fill="#FFF" font-family="YouTube Sans,Roboto,Arial,sans-serif">B</text>
    </svg>`),
  };

  function buildControls(): void {
    const setA = makeYtButton({
      action: 'set-start',
      title: 'Set Loop Start',
      ariaLabel: 'Set loop start',
      icon: ICONS.flagStart.cloneNode(true) as SVGElement,
    });
    setA.addEventListener('click', () => callbacks.setStart.forEach((cb) => cb(getTimeSource())));

    timeDisplayEl = document.createElement('span');
    timeDisplayEl.setAttribute('data-svl-display', 'time');
    timeDisplayEl.style.cssText = `
      display:inline-flex;align-items:center;align-self:center;
      height:36px;padding:0 10px;
      color:#FFF;font-family:'YouTube Sans','Roboto',Arial,sans-serif;
      font-size:13px;line-height:36px;
      white-space:nowrap;
    `;
    timeDisplayEl.textContent = '—:— — —:—';

    const setB = makeYtButton({
      action: 'set-end',
      title: 'Set Loop End',
      ariaLabel: 'Set loop end',
      icon: ICONS.flagEnd.cloneNode(true) as SVGElement,
    });
    setB.addEventListener('click', () => callbacks.setEnd.forEach((cb) => cb(getTimeSource())));

    toggleBtn = makeYtButton({
      action: 'toggle',
      title: 'Toggle Loop',
      ariaLabel: 'Toggle loop',
      icon: ICONS.loop.cloneNode(true) as SVGElement,
    });
    toggleBtn.addEventListener('click', () => callbacks.toggleLoop.forEach((cb) => cb()));

    elements.push(setA, timeDisplayEl, setB, toggleBtn);
  }

  // ── Tall bracket marker (video-editor style) ──────────────────────

  function makeMarker(type: MarkerType): HTMLElement {
    const label = type === 'start' ? 'A' : 'B';

    const handle = document.createElement('div');
    handle.setAttribute('data-svl-marker', type);
    handle.title = type === 'start'
      ? 'Loop Start (A) — drag to adjust'
      : 'Loop End (B) — drag to adjust';
    handle.style.cssText = `
      position:absolute;
      top:0;bottom:0;
      width:28px;margin-left:-14px;
      display:none;
      pointer-events:auto;
      z-index:75;
      cursor:ew-resize;
    `;

    const pillar = document.createElement('div');
    pillar.setAttribute('data-svl-pillar', '');
    pillar.style.cssText = `
      position:absolute;
      left:50%;transform:translateX(-50%);
      top:0;bottom:0;
      width:4px;
      background:${YT_RED};
      border-radius:2px;
      pointer-events:none;
    `;
    handle.appendChild(pillar);

    const badge = document.createElement('div');
    badge.setAttribute('data-svl-badge', '');
    badge.style.cssText = `
      position:absolute;
      left:50%;transform:translateX(-50%);
      top:-4px;
      padding:2px 6px;
      border-radius:3px;
      background:${YT_RED};
      color:${YT_WHITE};
      font-family:'YouTube Sans',Roboto,Arial,sans-serif;
      font-size:11px;font-weight:700;
      line-height:1.2;
      pointer-events:none;
      white-space:nowrap;
      z-index:1;
    `;
    badge.textContent = label;
    handle.appendChild(badge);

    return handle;
  }

  function makeRegion(): HTMLElement {
    const el = document.createElement('div');
    el.setAttribute('data-svl-loop-region', '');
    el.style.cssText = `
      position:absolute;
      top:0;bottom:0;
      background:rgba(255,0,0,0.2);
      z-index:35;
      display:none;
      pointer-events:none;
    `;
    return el;
  }

  // ── Drag via WINDOW-level mousemove/mouseup ─────────────────────

  function beginDrag(type: MarkerType, marker: HTMLElement, clientX: number): void {
    if (activeDrag) return;

    const bar = getProgressBar();
    if (!bar || !container) return;

    const containerRect = container.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();
    const barLeftInContainer = barRect.left - containerRect.left;
    const barWidth = barRect.width;
    const duration = getVideoDuration();
    if (duration === 0) return;

    function barRatio(cx: number): number {
      return Math.max(0, Math.min(1, (cx - barRect.left) / barRect.width));
    }

    const region = document.querySelector('[data-svl-loop-region]') as HTMLElement | null;
    const otherSel = type === 'start' ? '[data-svl-marker="end"]' : '[data-svl-marker="start"]';
    const other = document.querySelector(otherSel) as HTMLElement | null;

    let ratio = barRatio(clientX);
    if (ratio < 0) return;

    const time = ratio * duration;
    callbacks.dragMarker.forEach((cb) => cb(type, time));

    const pillar = marker.querySelector('[data-svl-pillar]') as HTMLElement | null;
    if (pillar) {
      pillar.style.background = YT_WHITE;
      pillar.style.boxShadow = '0 0 10px rgba(255,0,0,0.9)';
      pillar.style.width = '6px';
    }

    function moveMarkerDirect(r: number): void {
      const px = Math.round(barLeftInContainer + r * barWidth);
      marker.style.left = `${px}px`;

      if (region && other && other.style.display !== 'none') {
        const startLeft = type === 'start' ? px : parseFloat(other.style.left) || 0;
        const endLeft = type === 'end' ? px : parseFloat(other.style.left) || 0;
        region.style.left = `${Math.min(startLeft, endLeft)}px`;
        region.style.width = `${Math.abs(endLeft - startLeft)}px`;
      }

      if (timeDisplayEl) {
        const t = r * duration;
        if (type === 'start') {
          timeDisplayEl.textContent = `${formatTime(t)} — …`;
        } else {
          timeDisplayEl.textContent = `… — ${formatTime(t)}`;
        }
      }
    }

    moveMarkerDirect(ratio);

    const handleMove = (e: MouseEvent): void => {
      let r = barRatio(e.clientX);
      if (r < 0) return;

      if (other && other.style.display !== 'none') {
        const otherPx = parseFloat(other.style.left) || 0;
        const otherRatio = (otherPx - barLeftInContainer) / barWidth;
        if (type === 'start') {
          r = Math.min(r, otherRatio - 0.003);
        } else {
          r = Math.max(r, otherRatio + 0.003);
        }
      }

      r = Math.max(0, Math.min(1, r));
      moveMarkerDirect(r);
    };

    const handleUp = (): void => {
      if (pillar) {
        pillar.style.background = YT_RED;
        pillar.style.boxShadow = '';
        pillar.style.width = '4px';
      }

      const finalPx = parseFloat(marker.style.left) || 0;
      const finalRatio = (finalPx - barLeftInContainer) / barWidth;
      callbacks.dragMarker.forEach((cb) => cb(type, finalRatio * duration));

      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      if (activeDrag?.type === type) activeDrag = null;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    activeDrag = { type, marker, onUp: handleUp };
  }

  // ── Marker positioning (reusable) ───────────────────────────────

  function positionMarkers(start: number, end: number): void {
    if (!container) return;

    const video = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
    const duration = video?.duration ?? 0;
    if (duration === 0) return;

    const bar = getProgressBar();
    if (!bar) return;

    const containerRect = container.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();
    const startMarker = markersEl[0];
    const endMarker = markersEl[1];
    const region = markersEl[2];

    if (!startMarker || !endMarker || !region) return;

    const barLeftInParent = barRect.left - containerRect.left;
    const barTopInParent = barRect.top - containerRect.top;
    const barWidth = barRect.width;
    const barHeight = barRect.height;

    const startRatio = start / duration;
    const endRatio = end / duration;

    const MARKER_VERTICAL_EXTEND = 40;
    const MARKER_TOP_OFFSET = -MARKER_VERTICAL_EXTEND / 2;
    const markerHeight = Math.round(barHeight) + MARKER_VERTICAL_EXTEND;
    const markerTop = Math.round(barTopInParent) + MARKER_TOP_OFFSET;

    const playerHidden = container.classList.contains('ytp-autohide');

    startMarker.style.display = playerHidden ? 'none' : '';
    startMarker.style.left = `${Math.round(barLeftInParent + startRatio * barWidth)}px`;
    startMarker.style.top = `${markerTop}px`;
    startMarker.style.height = `${markerHeight}px`;

    endMarker.style.display = playerHidden ? 'none' : '';
    endMarker.style.left = `${Math.round(barLeftInParent + endRatio * barWidth)}px`;
    endMarker.style.top = `${markerTop}px`;
    endMarker.style.height = `${markerHeight}px`;

    region.style.display = playerHidden ? 'none' : '';
    region.style.left = `${Math.round(barLeftInParent + startRatio * barWidth)}px`;
    region.style.width = `${Math.round((endRatio - startRatio) * barWidth)}px`;
    region.style.top = `${Math.round(barTopInParent)}px`;
    region.style.height = `${Math.round(barHeight)}px`;
  }

  // ── Public API ──────────────────────────────────────────────────

  function inject(containerEl: HTMLElement): void {
    container = containerEl;

    patchOverflows();
    buildControls();

    const rightControls = container.querySelector('.ytp-right-controls');
    if (rightControls && toggleBtn && timeDisplayEl) {
      rightControls.prepend(...elements);
    } else {
      const bar = document.createElement('div');
      bar.setAttribute('data-svl-controls', '');
      bar.style.cssText = `
        position:absolute;bottom:50px;right:12px;display:flex;align-items:center;gap:6px;
        padding:4px 10px;font-family:'YouTube Sans',Roboto,Arial,sans-serif;
        font-size:13px;color:${YT_WHITE};background:${YT_BG};border-radius:8px;
        user-select:none;z-index:2000;pointer-events:auto;
      `;
      elements.forEach((el) => bar.appendChild(el));
      container.appendChild(bar);
      elements.push(bar);
    }

    const startMarker = makeMarker('start');
    const endMarker = makeMarker('end');
    const region = makeRegion();

    startMarker.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      beginDrag('start', startMarker, e.clientX);
    });
    endMarker.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      beginDrag('end', endMarker, e.clientX);
    });

    container.appendChild(region);
    container.appendChild(startMarker);
    container.appendChild(endMarker);

    markersEl = [startMarker, endMarker, region];

    // Watch for YouTube's auto-hide class
    autohideObserver = new MutationObserver(() => {
      if (!container) return;
      const hidden = container.classList.contains('ytp-autohide');
      markersEl.forEach((el) => {
        el.style.opacity = hidden ? '0' : '';
        el.style.pointerEvents = hidden ? 'none' : '';
      });
    });
    autohideObserver.observe(container, { attributes: true, attributeFilter: ['class'] });

    // Reposition markers when layout changes (resize, fullscreen, YouTube player expand/collapse).
    // Debounced — rects are invalid during the animation frame of a resize.
    resizeObserver = new ResizeObserver(() => {
      if (repositionTimer) clearTimeout(repositionTimer);
      repositionTimer = setTimeout(() => {
        if (currentPoints && container) {
          positionMarkers(currentPoints.start, currentPoints.end);
        }
      }, 100);
    });
    resizeObserver.observe(container);

    elements.push(startMarker, endMarker, region);
  }

  function destroy(): void {
    if (activeDrag) {
      activeDrag.onUp();
      activeDrag = null;
    }
    toggleBtn = null;
    timeDisplayEl = null;
    if (autohideObserver) {
      autohideObserver.disconnect();
      autohideObserver = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (repositionTimer) {
      clearTimeout(repositionTimer);
      repositionTimer = null;
    }
    currentPoints = null;
    markersEl = [];
    restoreOverflows();
    elements.forEach((el) => el.remove());
    elements = [];
    container = null;
    callbacks.setStart.clear();
    callbacks.setEnd.clear();
    callbacks.toggleLoop.clear();
    callbacks.dragMarker.clear();
  }

  function updateMarkers(start: number, end: number): void {
    if (!container) return;

    currentPoints = { start, end };

    if (timeDisplayEl) {
      timeDisplayEl.textContent = `${formatTime(start)} — ${formatTime(end)}`;
    }

    positionMarkers(start, end);
  }

  function setActive(active: boolean): void {
    if (!toggleBtn) return;
    const svg = toggleBtn.querySelector('svg') as SVGElement | null;
    if (!svg) return;

    const color = active ? YT_RED : YT_WHITE;
    // loop icon uses fill, flag icons use stroke — set both
    svg.querySelectorAll('path,polyline').forEach((el) => {
      const e = el as SVGElement;
      e.style.fill = color;
      e.style.stroke = color;
    });
  }

  function onSetStart(cb: (time: number) => void): () => void {
    callbacks.setStart.add(cb);
    return () => callbacks.setStart.delete(cb);
  }
  function onSetEnd(cb: (time: number) => void): () => void {
    callbacks.setEnd.add(cb);
    return () => callbacks.setEnd.delete(cb);
  }
  function onToggleLoop(cb: () => void): () => void {
    callbacks.toggleLoop.add(cb);
    return () => callbacks.toggleLoop.delete(cb);
  }
  function onDragMarker(type: MarkerType, cb: (time: number) => void): () => void {
    const wrapped = (_t: MarkerType, time: number) => {
      if (_t === type) cb(time);
    };
    callbacks.dragMarker.add(wrapped);
    return () => callbacks.dragMarker.delete(wrapped);
  }

  return { inject, destroy, updateMarkers, setActive, onSetStart, onSetEnd, onToggleLoop, onDragMarker };
}
