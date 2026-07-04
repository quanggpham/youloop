import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { createTimelineUI } from '../timeline-ui';

// Polyfill ResizeObserver for jsdom
beforeAll(() => {
  if (typeof ResizeObserver === 'undefined') {
    (globalThis as any).ResizeObserver = class ResizeObserver {
      constructor(_callback: ResizeObserverCallback) {}
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

function mockRect(props: Partial<DOMRect>): DOMRect {
  return {
    left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0,
    x: 0, y: 0,
    ...props,
    toJSON: () => JSON.stringify(props),
  } as DOMRect;
}

// Setup helper: container + progress bar + video mock
function setupDOM(containerWidth = 900, containerHeight = 600, barLeft = 48, barTop = 470, barWidth = 804, barHeight = 6) {
  const container = document.createElement('div');
  container.id = 'test-player';
  // container rect = 48 left offset within page (simulating movie_player)
  Object.defineProperty(container, 'getBoundingClientRect', {
    value: () => mockRect({ left: 0, top: 0, width: containerWidth, height: containerHeight }),
    configurable: true,
  });
  document.body.appendChild(container);

  const progressBar = document.createElement('div');
  progressBar.classList.add('ytp-progress-bar');
  Object.defineProperty(progressBar, 'getBoundingClientRect', {
    value: () => mockRect({ left: barLeft, top: barTop, width: barWidth, height: barHeight }),
    configurable: true,
  });
  container.appendChild(progressBar);

  return { container, progressBar };
}

function setupVideo(duration = 300) {
  const mockVideo = document.createElement('video');
  mockVideo.classList.add('html5-main-video');
  Object.defineProperty(mockVideo, 'duration', { value: duration, writable: true });
  Object.defineProperty(mockVideo, 'currentTime', { value: 60, writable: true });
  document.body.appendChild(mockVideo);
  return mockVideo;
}

describe('TimelineUI', () => {
  let container: HTMLElement;

  beforeEach(() => {
    const dom = setupDOM();
    container = dom.container;
  });

  afterEach(() => {
    document.querySelectorAll('video.html5-main-video').forEach((v) => v.remove());
    if (document.body.contains(container)) document.body.removeChild(container);
  });

  it('injects control buttons into the container', () => {
    const ui = createTimelineUI();
    ui.inject(container);

    const buttons = container.querySelectorAll('[data-svl-button]');
    expect(buttons.length).toBe(3);
    ui.destroy();
  });

  it('toggle button has correct default text', () => {
    const ui = createTimelineUI();
    ui.inject(container);

    const toggle = container.querySelector('[data-svl-action="toggle"]');
    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute('title')).toContain('Toggle Loop');
    ui.destroy();
  });

  it('calls onToggleLoop callback when toggle clicked', () => {
    const ui = createTimelineUI();
    ui.inject(container);

    const toggleCalls: number[] = [];
    ui.onToggleLoop(() => toggleCalls.push(1));

    const toggle = container.querySelector('[data-svl-action="toggle"]') as HTMLElement;
    toggle.click();
    expect(toggleCalls.length).toBe(1);
    ui.destroy();
  });

  it('updateMarkers updates time display text', () => {
    setupVideo(300);
    const ui = createTimelineUI();
    ui.inject(container);

    ui.updateMarkers(90, 225);
    const display = container.querySelector('[data-svl-display="time"]');
    expect(display?.textContent).toBe('1:30 — 3:45');
    ui.destroy();
  });

  it('updateMarkers shows h:mm:ss for videos over 60 minutes', () => {
    setupVideo(5000); // 83 min 20 sec
    const ui = createTimelineUI();
    ui.inject(container);

    ui.updateMarkers(3720, 4500); // 1:02:00 — 1:15:00
    const display = container.querySelector('[data-svl-display="time"]');
    expect(display?.textContent).toBe('1:02:00 — 1:15:00');
    ui.destroy();
  });

  it('destroy removes all injected elements', () => {
    const ui = createTimelineUI();
    ui.inject(container);
    ui.destroy();

    const remaining = container.querySelectorAll('[data-svl-button]');
    expect(remaining.length).toBe(0);
  });

  it('destroy also cleans up event listeners (no-op after destroy)', () => {
    const ui = createTimelineUI();
    ui.inject(container);
    ui.destroy();

    expect(() => ui.destroy()).not.toThrow();
  });

  it('returns cleanup from callback registrations', () => {
    const ui = createTimelineUI();
    ui.inject(container);

    const cleanup = ui.onSetStart(() => {});
    expect(typeof cleanup).toBe('function');
    cleanup();
    ui.destroy();
  });

  it('setActive changes toggle button icon color', () => {
    const ui = createTimelineUI();
    ui.inject(container);

    ui.setActive(true);
    const toggle = container.querySelector('[data-svl-action="toggle"]') as HTMLElement;
    const svg = toggle?.querySelector('svg') as SVGElement;
    expect(svg).not.toBeNull();
    // Active = red fill on paths
    const path = svg.querySelector('path') as SVGElement;
    expect(path.style.fill).toBe('rgb(255, 0, 0)');

    ui.setActive(false);
    // Inactive = back to white
    expect(path.style.fill).not.toBe('rgb(255, 0, 0)');

    ui.destroy();
  });

  it('markers hide when container has ytp-autohide class', () => {
    setupVideo(300);
    const ui = createTimelineUI();
    ui.inject(container);
    ui.updateMarkers(30, 120);

    // Simulate YouTube autohide
    container.classList.add('ytp-autohide');

    // Trigger mutation (simulate what the observer would do)
    const startMarker = container.querySelector('[data-svl-marker="start"]') as HTMLElement;
    const endMarker = container.querySelector('[data-svl-marker="end"]') as HTMLElement;
    const region = container.querySelector('[data-svl-loop-region]') as HTMLElement;

    // When autohide is on, updateMarkers sets display:none
    ui.updateMarkers(30, 120);
    expect(startMarker.style.display).toBe('none');
    expect(endMarker.style.display).toBe('none');
    expect(region.style.display).toBe('none');

    // Remove autohide
    container.classList.remove('ytp-autohide');
    ui.updateMarkers(30, 120);
    expect(startMarker.style.display).toBe('');
    expect(endMarker.style.display).toBe('');
    expect(region.style.display).toBe('');

    ui.destroy();
  });

  it('controls prepend into .ytp-right-controls when available', () => {
    // Create a mock right-controls div
    const rightControls = document.createElement('div');
    rightControls.classList.add('ytp-right-controls');
    container.appendChild(rightControls);

    // Add a native button to verify order
    const nativeBtn = document.createElement('button');
    nativeBtn.classList.add('ytp-button');
    rightControls.appendChild(nativeBtn);

    const ui = createTimelineUI();
    ui.inject(container);

    // Our buttons should be before the native one
    const allButtons = rightControls.querySelectorAll('[data-svl-button]');
    expect(allButtons.length).toBe(3);

    // First child should be our element (we prepended)
    const firstChild = rightControls.firstElementChild;
    expect(firstChild?.getAttribute('data-svl-button')).toBe('');

    ui.destroy();
  });
});

describe('TimelineUI — markers', () => {
  let container: HTMLElement;

  beforeEach(() => {
    const dom = setupDOM();
    container = dom.container;
  });

  afterEach(() => {
    document.querySelectorAll('video.html5-main-video').forEach((v) => v.remove());
    if (document.body.contains(container)) document.body.removeChild(container);
  });

  it('renders two markers in the container (not progress bar)', () => {
    const ui = createTimelineUI();
    ui.inject(container);

    // Markers are direct children of container
    const markers = container.querySelectorAll('[data-svl-marker]');
    expect(markers.length).toBe(2);
    ui.destroy();
  });

  it('markers have correct label badges (A and B)', () => {
    const ui = createTimelineUI();
    ui.inject(container);

    const startMarker = container.querySelector('[data-svl-marker="start"]') as HTMLElement;
    const endMarker = container.querySelector('[data-svl-marker="end"]') as HTMLElement;

    const startBadge = startMarker.querySelector('[data-svl-badge]');
    const endBadge = endMarker.querySelector('[data-svl-badge]');
    expect(startBadge?.textContent).toBe('A');
    expect(endBadge?.textContent).toBe('B');
    ui.destroy();
  });

  it('each marker has a pillar element', () => {
    const ui = createTimelineUI();
    ui.inject(container);

    const startMarker = container.querySelector('[data-svl-marker="start"]') as HTMLElement;
    expect(startMarker.querySelector('[data-svl-pillar]')).not.toBeNull();
    ui.destroy();
  });

  it('renders a loop region element', () => {
    setupVideo(300);
    const ui = createTimelineUI();
    ui.inject(container);
    ui.updateMarkers(30, 120);

    const region = container.querySelector('[data-svl-loop-region]') as HTMLElement;
    expect(region).not.toBeNull();
    expect(region.style.display).not.toBe('none');
    ui.destroy();
  });

  it('renders markers at correct positions relative to container', () => {
    setupVideo(300);
    const ui = createTimelineUI();
    ui.inject(container);
    ui.updateMarkers(30, 120); // 10% and 40% of 300s

    // Progress bar rect: left=48, top=470, width=804 → start at 48 + 0.1*804 = 128, end at 48 + 0.4*804 = 369
    const startMarker = container.querySelector('[data-svl-marker="start"]') as HTMLElement;
    const endMarker = container.querySelector('[data-svl-marker="end"]') as HTMLElement;
    const region = container.querySelector('[data-svl-loop-region]') as HTMLElement;

    expect(startMarker.style.left).toBe('128px');  // 48 + round(0.1*804) = 48+80 = 128
    expect(endMarker.style.left).toBe('370px');    // 48 + round(0.4*804) = 48+322 = 370
    expect(region.style.width).toBe('241px');       // round((0.4-0.1)*804) = round(241.2) = 241
    // Region height should match progress bar height
    expect(region.style.height).toBe('6px');
    ui.destroy();
  });

  it('hides markers when no loop points set', () => {
    const ui = createTimelineUI();
    ui.inject(container);

    const markers = container.querySelectorAll('[data-svl-marker]');
    markers.forEach((m) => {
      expect((m as HTMLElement).style.display).toBe('none');
    });
    ui.destroy();
  });

  it('markers have correct drag cursor', () => {
    const ui = createTimelineUI();
    ui.inject(container);

    const marker = container.querySelector('[data-svl-marker="start"]') as HTMLElement;
    expect(marker.style.cursor).toBe('ew-resize');
    ui.destroy();
  });

  it('destroys markers and region on destroy', () => {
    const ui = createTimelineUI();
    ui.inject(container);
    ui.destroy();

    expect(container.querySelectorAll('[data-svl-marker]').length).toBe(0);
    expect(container.querySelector('[data-svl-loop-region]')).toBeNull();
  });
});

describe('TimelineUI — drag interaction', () => {
  let container: HTMLElement;

  beforeEach(() => {
    const dom = setupDOM();
    container = dom.container;
    setupVideo(300);
  });

  afterEach(() => {
    document.querySelectorAll('video.html5-main-video').forEach((v) => v.remove());
    if (document.body.contains(container)) document.body.removeChild(container);
  });

  it('calls drag callback on mousedown on start marker', () => {
    const ui = createTimelineUI();
    ui.inject(container);
    ui.updateMarkers(30, 120); // make markers visible (left=128px and 370px)

    const dragCalls: Array<{ type: string; time: number }> = [];
    ui.onDragMarker('start', (time) => dragCalls.push({ type: 'start', time }));

    const startMarker = container.querySelector('[data-svl-marker="start"]') as HTMLElement;

    // clientX=160, bar left=48, bar width=804 → ratio = (160-48)/804 = 0.1393 → time = 41.8s
    startMarker.dispatchEvent(new MouseEvent('mousedown', { clientX: 160, bubbles: true }));

    expect(dragCalls.length).toBeGreaterThanOrEqual(1);
    if (dragCalls.length > 0) {
      expect(dragCalls[0].time).toBeCloseTo(41.8, 0);
    }
    // Window listeners should be cleaned up
    window.dispatchEvent(new MouseEvent('mouseup'));
    ui.destroy();
  });

  it('calls drag callback on mousedown on end marker', () => {
    const ui = createTimelineUI();
    ui.inject(container);
    ui.updateMarkers(30, 120);

    const dragCalls: Array<{ type: string; time: number }> = [];
    ui.onDragMarker('end', (time) => dragCalls.push({ type: 'end', time }));

    const endMarker = container.querySelector('[data-svl-marker="end"]') as HTMLElement;

    // clientX=400, bar left=48, bar width=804 → ratio = (400-48)/804 = 0.4378 → time = 131.3s
    endMarker.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, bubbles: true }));

    expect(dragCalls.length).toBeGreaterThanOrEqual(1);
    if (dragCalls.length > 0) {
      expect(dragCalls[0].time).toBeCloseTo(131.3, 0);
    }

    window.dispatchEvent(new MouseEvent('mouseup'));
    ui.destroy();
  });

  it('moves marker visually on mousemove while dragging', () => {
    const ui = createTimelineUI();
    ui.inject(container);
    ui.updateMarkers(30, 120);

    const startMarker = container.querySelector('[data-svl-marker="start"]') as HTMLElement;

    // Start drag at clientX 160
    startMarker.dispatchEvent(new MouseEvent('mousedown', { clientX: 160, bubbles: true }));
    const initialLeft = parseFloat(startMarker.style.left) || 0;

    // Move to clientX 200: ratio = (200-48)/804 = 0.1891 → barLeft=48 + 0.1891*804 = 200px
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, bubbles: true }));

    // Marker should have moved visually (style.left changed)
    const newLeft = parseFloat(startMarker.style.left) || 0;
    expect(newLeft).not.toBe(initialLeft);
    // ~ 48 + round(0.1891*804) = 48+152 = 200
    expect(newLeft).toBeGreaterThan(initialLeft);

    // Window cleanup
    window.dispatchEvent(new MouseEvent('mouseup'));
    ui.destroy();
  });

  it('fires drag callback on mouseup (final position)', () => {
    const ui = createTimelineUI();
    ui.inject(container);
    ui.updateMarkers(30, 120);

    const dragCalls: Array<{ type: string; time: number }> = [];
    ui.onDragMarker('start', (time) => dragCalls.push({ type: 'start', time }));

    const startMarker = container.querySelector('[data-svl-marker="start"]') as HTMLElement;

    // Mouse down fires initial callback
    startMarker.dispatchEvent(new MouseEvent('mousedown', { clientX: 160, bubbles: true }));
    expect(dragCalls.length).toBe(1); // initial callback

    // Move does NOT fire callback (marker moves directly)
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, bubbles: true }));
    expect(dragCalls.length).toBe(1); // still 1

    // Mouse up fires final callback
    window.dispatchEvent(new MouseEvent('mouseup'));
    expect(dragCalls.length).toBe(2); // final callback fired

    // Move after up should be ignored (no more callbacks)
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 240, bubbles: true }));
    expect(dragCalls.length).toBe(2);

    ui.destroy();
  });

  it('start marker clamps against end marker position (visual)', () => {
    const ui = createTimelineUI();
    ui.inject(container);
    ui.updateMarkers(30, 120); // start at 128px, end at 370px

    const startMarker = container.querySelector('[data-svl-marker="start"]') as HTMLElement;
    const endMarker = container.querySelector('[data-svl-marker="end"]') as HTMLElement;

    // Try to drag start past end — clientX 500
    startMarker.dispatchEvent(new MouseEvent('mousedown', { clientX: 200, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, bubbles: true }));

    // Start marker left should NOT exceed end marker left
    const startLeft = parseFloat(startMarker.style.left) || 0;
    const endLeft = parseFloat(endMarker.style.left) || Infinity;
    expect(startLeft).toBeLessThan(endLeft);

    window.dispatchEvent(new MouseEvent('mouseup'));
    ui.destroy();
  });

  it('end marker clamps against start marker position (visual)', () => {
    const ui = createTimelineUI();
    ui.inject(container);
    ui.updateMarkers(30, 120);

    const startMarker = container.querySelector('[data-svl-marker="start"]') as HTMLElement;
    const endMarker = container.querySelector('[data-svl-marker="end"]') as HTMLElement;

    // Try to drag end before start — clientX 60
    endMarker.dispatchEvent(new MouseEvent('mousedown', { clientX: 200, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 60, bubbles: true }));

    // End marker left should NOT go below start marker left
    const startLeft = parseFloat(startMarker.style.left) || 0;
    const endLeft = parseFloat(endMarker.style.left) || 0;
    expect(endLeft).toBeGreaterThan(startLeft);

    window.dispatchEvent(new MouseEvent('mouseup'));
    ui.destroy();
  });

  it('drag does not fire callbacks when video has no duration', () => {
    // Remove the video set up in beforeEach
    document.querySelectorAll('video.html5-main-video').forEach((v) => v.remove());

    const ui = createTimelineUI();
    ui.inject(container);

    const dragCalls: number[] = [];
    ui.onDragMarker('start', () => dragCalls.push(1));

    const startMarker = container.querySelector('[data-svl-marker="start"]') as HTMLElement;
    startMarker.dispatchEvent(new MouseEvent('mousedown', { clientX: 160, bubbles: true }));

    expect(dragCalls.length).toBe(0);

    window.dispatchEvent(new MouseEvent('mouseup'));
    ui.destroy();
  });
});
