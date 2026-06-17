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

// YouTube-native color palette
const YT_RED = 'rgb(255, 0, 0)';
const YT_WHITE = '#FFFFFF';
const YT_BG = 'rgba(0, 0, 0, 0.8)';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function createTimelineUI(): TimelineUI {
  let container: HTMLElement | null = null;
  let elements: HTMLElement[] = [];
  let dragCleanups: Array<() => void> = [];
  const callbacks = {
    setStart: new Set<(t: number) => void>(),
    setEnd: new Set<(t: number) => void>(),
    toggleLoop: new Set<() => void>(),
    dragMarker: new Set<(type: 'start' | 'end', t: number) => void>(),
  };

  function getTimeSource(): number {
    const video = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
    return video?.currentTime ?? 0;
  }

  function buildControls(): HTMLElement {
    const bar = document.createElement('div');
    bar.setAttribute('data-svl-controls', '');
    bar.style.cssText = `
      position: absolute;
      top: 10px;
      left: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 12px;
      font-family: 'YouTube Sans', 'Roboto', Arial, sans-serif;
      font-size: 13px;
      color: ${YT_WHITE};
      background: ${YT_BG};
      border-radius: 8px;
      user-select: none;
      z-index: 2000;
      pointer-events: auto;
    `;

    // Toggle button
    const toggle = document.createElement('button');
    toggle.setAttribute('data-svl-button', '');
    toggle.setAttribute('data-svl-action', 'toggle');
    toggle.title = 'Toggle Loop (Ctrl+Shift+L)';
    toggle.style.cssText = `
      background: none;
      border: 2px solid ${YT_RED};
      color: ${YT_WHITE};
      border-radius: 4px;
      padding: 4px 12px;
      cursor: pointer;
      font-size: 13px;
      font-family: inherit;
      font-weight: 600;
      transition: background 0.15s ease, color 0.15s ease;
    `;
    toggle.textContent = 'A↻B';
    toggle.addEventListener('click', () => callbacks.toggleLoop.forEach((cb) => cb()));
    bar.appendChild(toggle);

    // Set A button
    const setA = document.createElement('button');
    setA.setAttribute('data-svl-button', '');
    setA.setAttribute('data-svl-action', 'set-start');
    setA.title = 'Set Loop Start (Ctrl+Shift+A)';
    setA.style.cssText = `
      background: none;
      border: 2px solid rgba(255,255,255,0.5);
      color: ${YT_WHITE};
      border-radius: 4px;
      padding: 4px 10px;
      cursor: pointer;
      font-size: 13px;
      font-family: inherit;
      transition: border-color 0.15s;
    `;
    setA.textContent = '⏺ A';
    setA.addEventListener('click', () => {
      const t = getTimeSource();
      callbacks.setStart.forEach((cb) => cb(t));
    });
    bar.appendChild(setA);

    // Set B button
    const setB = document.createElement('button');
    setB.setAttribute('data-svl-button', '');
    setB.setAttribute('data-svl-action', 'set-end');
    setB.title = 'Set Loop End (Ctrl+Shift+B)';
    setB.style.cssText = `
      background: none;
      border: 2px solid rgba(255,255,255,0.5);
      color: ${YT_WHITE};
      border-radius: 4px;
      padding: 4px 10px;
      cursor: pointer;
      font-size: 13px;
      font-family: inherit;
      transition: border-color 0.15s;
    `;
    setB.textContent = '⏹ B';
    setB.addEventListener('click', () => {
      const t = getTimeSource();
      callbacks.setEnd.forEach((cb) => cb(t));
    });
    bar.appendChild(setB);

    // Time display
    const timeDisplay = document.createElement('span');
    timeDisplay.setAttribute('data-svl-display', 'time');
    timeDisplay.style.cssText = `
      color: ${YT_WHITE};
      font-weight: 600;
      font-family: 'Roboto Mono', monospace;
      font-size: 13px;
      min-width: 100px;
    `;
    timeDisplay.textContent = '—:— — —:—';
    bar.appendChild(timeDisplay);

    return bar;
  }

  function buildMarkers(): { wrapper: HTMLElement; start: HTMLElement; end: HTMLElement; region: HTMLElement } {
    // Wrapper to contain all marker elements
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-svl-marker-wrapper', '');
    wrapper.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 50;
      pointer-events: none;
    `;

    function makeMarker(attr: string, title: string): HTMLElement {
      const container = document.createElement('div');
      container.setAttribute('data-svl-marker', attr);
      container.title = title;
      // Invisible wide hitbox (20px) so it's easy to grab, centered on the visual line
      container.style.cssText = `
        position: absolute;
        top: -10px;
        bottom: -10px;
        width: 20px;
        margin-left: -10px;
        cursor: ew-resize;
        display: none;
        pointer-events: auto;
        z-index: 51;
      `;

      const line = document.createElement('div');
      line.style.cssText = `
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        top: 10px;
        bottom: 10px;
        width: 3px;
        background: ${YT_RED};
        border-radius: 2px;
        pointer-events: none;
      `;
      container.appendChild(line);

      // Large handle circle below the progress bar
      const handle = document.createElement('div');
      handle.style.cssText = `
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        bottom: -8px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: ${YT_RED};
        border: 2px solid ${YT_WHITE};
        box-shadow: 0 2px 6px rgba(0,0,0,0.6);
        pointer-events: none;
      `;
      container.appendChild(handle);

      return container;
    }

    const startMarker = makeMarker('start', 'Loop Start — drag to adjust');
    const endMarker = makeMarker('end', 'Loop End — drag to adjust');

    const region = document.createElement('div');
    region.setAttribute('data-svl-loop-region', '');
    region.style.cssText = `
      position: absolute;
      top: 0;
      bottom: 0;
      background: rgba(255,0,0,0.2);
      z-index: 49;
      display: none;
      pointer-events: none;
    `;

    return { wrapper, start: startMarker, end: endMarker, region };
  }

  function setupDrag(
    marker: HTMLElement,
    type: 'start' | 'end',
    getProgressBar: () => HTMLElement | null,
    getVideoDuration: () => number,
  ): () => void {
    function onDown(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
      // Lock ALL mouse events to this element until mouseup — YouTube can't steal them
      marker.setPointerCapture(e.pointerId);
      marker.style.zIndex = '60'; // bring to front while dragging

      const bar = getProgressBar();
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const time = ratio * getVideoDuration();
      callbacks.dragMarker.forEach((cb) => cb(type, time));
    }

    function onMove(e: MouseEvent) {
      // setPointerCapture means we get events even outside the element
      const bar = getProgressBar();
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const time = ratio * getVideoDuration();
      callbacks.dragMarker.forEach((cb) => cb(type, time));
    }

    function onUp(e: MouseEvent) {
      marker.releasePointerCapture(e.pointerId);
      marker.style.zIndex = '51'; // restore
    }

    marker.addEventListener('pointerdown', onDown);
    marker.addEventListener('pointermove', onMove);
    marker.addEventListener('pointerup', onUp);
    marker.addEventListener('lostpointercapture', onUp);

    return () => {
      marker.removeEventListener('pointerdown', onDown);
      marker.removeEventListener('pointermove', onMove);
      marker.removeEventListener('pointerup', onUp);
      marker.removeEventListener('lostpointercapture', onUp);
    };
  }

  function inject(containerEl: HTMLElement): void {
    container = containerEl;
    const controls = buildControls();
    container.appendChild(controls);
    elements = [controls];

    // Find the progress bar — try multiple selectors since YouTube's DOM changes
    const progressBar = document.querySelector('.ytp-progress-bar') as HTMLElement | null
      || container.querySelector('.ytp-progress-bar') as HTMLElement | null;

    if (progressBar) {
      if (getComputedStyle(progressBar).position === 'static') {
        progressBar.style.position = 'relative';
      }
      const markers = buildMarkers();
      // Append wrapper first, then markers and region into wrapper
      progressBar.appendChild(markers.wrapper);
      markers.wrapper.appendChild(markers.region);
      markers.wrapper.appendChild(markers.start);
      markers.wrapper.appendChild(markers.end);

      const cleanup1 = setupDrag(markers.start, 'start', () => {
        return document.querySelector('.ytp-progress-bar') as HTMLElement | null
          || container!.querySelector('.ytp-progress-bar') as HTMLElement | null;
      }, () => {
        const video = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
        return video?.duration ?? 0;
      });
      const cleanup2 = setupDrag(markers.end, 'end', () => {
        return document.querySelector('.ytp-progress-bar') as HTMLElement | null
          || container!.querySelector('.ytp-progress-bar') as HTMLElement | null;
      }, () => {
        const video = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
        return video?.duration ?? 0;
      });

      dragCleanups = [cleanup1, cleanup2];
      elements.push(markers.wrapper); // wrapper contains all marker elements
    }
  }

  function destroy(): void {
    dragCleanups.forEach((fn) => fn());
    dragCleanups = [];
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
    const display = container.querySelector('[data-svl-display="time"]');
    if (display) {
      display.textContent = `${formatTime(start)} — ${formatTime(end)}`;
    }

    const progressBar = document.querySelector('.ytp-progress-bar') as HTMLElement | null
      || container.querySelector('.ytp-progress-bar') as HTMLElement | null;
    if (!progressBar) return;

    const video = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
    const duration = video?.duration ?? 0;
    if (duration === 0) return;

    const startRatio = start / duration;
    const endRatio = end / duration;
    const barWidth = progressBar.getBoundingClientRect().width;

    const startMarker = progressBar.querySelector('[data-svl-marker="start"]') as HTMLElement | null;
    const endMarker = progressBar.querySelector('[data-svl-marker="end"]') as HTMLElement | null;
    const region = progressBar.querySelector('[data-svl-loop-region]') as HTMLElement | null;

    if (startMarker) {
      startMarker.style.display = '';
      startMarker.style.left = `${Math.round(startRatio * barWidth)}px`;
    }
    if (endMarker) {
      endMarker.style.display = '';
      endMarker.style.left = `${Math.round(endRatio * barWidth)}px`;
    }
    if (region) {
      region.style.display = '';
      region.style.left = `${Math.round(startRatio * barWidth)}px`;
      region.style.width = `${Math.round((endRatio - startRatio) * barWidth)}px`;
    }
  }

  function setActive(active: boolean): void {
    if (!container) return;
    const toggle = container.querySelector('[data-svl-action="toggle"]') as HTMLElement | null;
    if (toggle) {
      toggle.style.background = active ? YT_RED : 'none';
      toggle.style.borderColor = active ? YT_RED : YT_RED;
      toggle.style.color = active ? YT_WHITE : YT_WHITE;
    }
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

  function onDragMarker(type: 'start' | 'end', cb: (time: number) => void): () => void {
    const wrapped = (_t: 'start' | 'end', time: number) => {
      if (_t === type) cb(time);
    };
    callbacks.dragMarker.add(wrapped);
    return () => callbacks.dragMarker.delete(wrapped);
  }

  return { inject, destroy, updateMarkers, setActive, onSetStart, onSetEnd, onToggleLoop, onDragMarker };
}
