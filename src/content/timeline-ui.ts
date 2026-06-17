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

  function inject(containerEl: HTMLElement): void {
    container = containerEl;
    const controls = buildControls();
    container.appendChild(controls);
    elements = [controls];
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
