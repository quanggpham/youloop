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

const ACCENT = '#FF4081';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function createTimelineUI(): TimelineUI {
  let container: HTMLElement | null = null;
  let elements: HTMLElement[] = [];
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
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 14px;
      font-family: 'YouTube Sans', 'Roboto', sans-serif;
      font-size: 13px;
      color: #fff;
      background: rgba(0,0,0,0.4);
      border-radius: 4px;
      user-select: none;
    `;

    const toggle = document.createElement('button');
    toggle.setAttribute('data-svl-button', '');
    toggle.setAttribute('data-svl-action', 'toggle');
    toggle.title = 'Toggle Loop';
    toggle.style.cssText = `
      background: none;
      border: 1px solid ${ACCENT};
      color: #fff;
      border-radius: 4px;
      padding: 4px 12px;
      cursor: pointer;
      font-size: 14px;
      font-family: inherit;
      transition: background 0.15s ease, color 0.15s ease;
    `;
    toggle.textContent = 'A↻ B';
    toggle.addEventListener('click', () => callbacks.toggleLoop.forEach((cb) => cb()));
    bar.appendChild(toggle);

    const setA = document.createElement('button');
    setA.setAttribute('data-svl-button', '');
    setA.setAttribute('data-svl-action', 'set-start');
    setA.title = 'Set Loop Start (A)';
    setA.style.cssText = `
      background: none;
      border: 1px solid ${ACCENT};
      color: #fff;
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

    const setB = document.createElement('button');
    setB.setAttribute('data-svl-button', '');
    setB.setAttribute('data-svl-action', 'set-end');
    setB.title = 'Set Loop End (B)';
    setB.style.cssText = `
      background: none;
      border: 1px solid ${ACCENT};
      color: #fff;
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

    const timeDisplay = document.createElement('span');
    timeDisplay.setAttribute('data-svl-display', 'time');
    timeDisplay.style.cssText = `
      color: ${ACCENT};
      font-weight: 600;
      font-family: 'Roboto Mono', monospace;
      font-size: 13px;
    `;
    timeDisplay.textContent = '—: — — —: —';
    bar.appendChild(timeDisplay);

    return bar;
  }

  function buildMarkers(): { start: HTMLElement; end: HTMLElement; region: HTMLElement } {
    const startMarker = document.createElement('div');
    startMarker.setAttribute('data-svl-marker', 'start');
    startMarker.style.cssText = `
      position: absolute;
      top: 0;
      bottom: 0;
      width: 3px;
      background: ${ACCENT};
      cursor: ew-resize;
      z-index: 10;
      display: none;
    `;

    const endMarker = document.createElement('div');
    endMarker.setAttribute('data-svl-marker', 'end');
    endMarker.style.cssText = `
      position: absolute;
      top: 0;
      bottom: 0;
      width: 3px;
      background: ${ACCENT};
      cursor: ew-resize;
      z-index: 10;
      display: none;
    `;

    const region = document.createElement('div');
    region.setAttribute('data-svl-loop-region', '');
    region.style.cssText = `
      position: absolute;
      top: 0;
      bottom: 0;
      background: rgba(255,64,129,0.25);
      z-index: 9;
      display: none;
    `;

    return { start: startMarker, end: endMarker, region };
  }

  function setupDrag(
    marker: HTMLElement,
    type: 'start' | 'end',
    getProgressBar: () => HTMLElement | null,
    getVideoDuration: () => number,
  ): void {
    let dragging = false;

    marker.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const bar = getProgressBar();
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const time = ratio * getVideoDuration();
      callbacks.dragMarker.forEach((cb) => cb(type, time));
    });

    document.addEventListener('mouseup', () => {
      if (dragging) {
        dragging = false;
        document.body.style.userSelect = '';
      }
    });
  }

  function inject(containerEl: HTMLElement): void {
    container = containerEl;
    const controls = buildControls();
    container.appendChild(controls);
    elements = [controls];

    const progressBar = container.querySelector('.ytp-progress-bar') as HTMLElement | null;
    if (progressBar) {
      if (getComputedStyle(progressBar).position === 'static') {
        progressBar.style.position = 'relative';
      }
      const markers = buildMarkers();
      progressBar.appendChild(markers.start);
      progressBar.appendChild(markers.region);
      progressBar.appendChild(markers.end);

      setupDrag(markers.start, 'start', () => progressBar, () => {
        const video = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
        return video?.duration ?? 0;
      });
      setupDrag(markers.end, 'end', () => progressBar, () => {
        const video = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
        return video?.duration ?? 0;
      });

      elements.push(markers.start, markers.region, markers.end);
    }
  }

  function destroy(): void {
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

    const progressBar = container.querySelector('.ytp-progress-bar') as HTMLElement | null;
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
      toggle.style.background = active ? ACCENT : 'none';
      toggle.style.color = active ? '#000' : '#fff';
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
