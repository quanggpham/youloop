import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTimelineUI } from '../timeline-ui';

describe('TimelineUI', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-player';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
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
    expect(toggle?.getAttribute('title')).toBe('Toggle Loop');
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
  });

  it('updateMarkers updates time display text', () => {
    const ui = createTimelineUI();
    ui.inject(container);

    ui.updateMarkers(90, 225);
    const display = container.querySelector('[data-svl-display="time"]');
    expect(display?.textContent).toBe('1:30 — 3:45');
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
});

describe('TimelineUI — progress bar markers', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-player';
    const progressBar = document.createElement('div');
    progressBar.classList.add('ytp-progress-bar');
    Object.defineProperty(progressBar, 'getBoundingClientRect', {
      value: () => ({ left: 0, width: 800, right: 800 } as DOMRect),
      writable: true,
    });
    container.appendChild(progressBar);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders two markers on the progress bar', () => {
    const ui = createTimelineUI();
    ui.inject(container);

    const markers = container.querySelectorAll('[data-svl-marker]');
    expect(markers.length).toBe(2);
    ui.destroy();
  });

  it('renders a loop region highlight between markers', () => {
    // Mock a video element so duration is available for marker positioning
    const mockVideo = document.createElement('video');
    mockVideo.classList.add('html5-main-video');
    Object.defineProperty(mockVideo, 'duration', { value: 300, writable: true });
    document.body.appendChild(mockVideo);

    const ui = createTimelineUI();
    ui.inject(container);
    ui.updateMarkers(30, 120);

    const highlight = container.querySelector('[data-svl-loop-region]') as HTMLElement;
    expect(highlight).not.toBeNull();
    expect(highlight.style.display).not.toBe('none');
    mockVideo.remove();
    ui.destroy();
  });

  it('renders markers at correct positions based on video duration', () => {
    const mockVideo = document.createElement('video');
    mockVideo.classList.add('html5-main-video');
    Object.defineProperty(mockVideo, 'duration', { value: 300, writable: true });
    document.body.appendChild(mockVideo);

    const ui = createTimelineUI();
    ui.inject(container);
    ui.updateMarkers(30, 120); // 10% and 40% of 300s

    const startMarker = container.querySelector('[data-svl-marker="start"]') as HTMLElement;
    const endMarker = container.querySelector('[data-svl-marker="end"]') as HTMLElement;
    const region = container.querySelector('[data-svl-loop-region]') as HTMLElement;

    // 30/300 * 800px = 80px, 120/300 * 800px = 320px
    expect(startMarker.style.left).toBe('80px');
    expect(endMarker.style.left).toBe('320px');
    expect(region.style.width).toBe('240px');

    mockVideo.remove();
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

  it('destroys markers and highlight on destroy', () => {
    const ui = createTimelineUI();
    ui.inject(container);
    ui.destroy();

    expect(container.querySelectorAll('[data-svl-marker]').length).toBe(0);
    expect(container.querySelector('[data-svl-loop-region]')).toBeNull();
  });
});