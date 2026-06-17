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
