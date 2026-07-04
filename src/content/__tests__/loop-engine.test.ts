import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLoopEngine } from '../loop-engine';

function createMockVideo(): HTMLVideoElement {
  return {
    currentTime: 0,
    play: vi.fn(),
    pause: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLVideoElement;
}

describe('LoopEngine', () => {
  let video: HTMLVideoElement;
  let engine: ReturnType<typeof createLoopEngine>;

  beforeEach(() => {
    vi.useFakeTimers();
    video = createMockVideo();
    engine = createLoopEngine(video);
  });

  afterEach(() => {
    engine.disable();
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('is not active by default', () => {
      expect(engine.isActive()).toBe(false);
    });

    it('has no loop points by default', () => {
      expect(engine.getLoopPoints()).toBeNull();
    });
  });

  describe('setLoop', () => {
    it('sets loop points', () => {
      engine.setLoop(10, 30);
      const points = engine.getLoopPoints();
      expect(points).toEqual({ start: 10, end: 30 });
    });

    it('auto-swaps when start > end', () => {
      engine.setLoop(30, 10);
      const points = engine.getLoopPoints();
      expect(points).toEqual({ start: 10, end: 30 });
    });

    it('rejects equal start and end', () => {
      expect(() => engine.setLoop(10, 10)).toThrow('Start and end cannot be equal');
    });
  });

  describe('enable/disable', () => {
    it('starts active after enable', () => {
      engine.setLoop(0, 10);
      engine.enable();
      expect(engine.isActive()).toBe(true);
    });

    it('does not enable without loop points', () => {
      expect(() => engine.enable()).toThrow('Cannot enable loop: no loop points set');
    });

    it('stops after disable', () => {
      engine.setLoop(0, 10);
      engine.enable();
      engine.disable();
      expect(engine.isActive()).toBe(false);
    });
  });

  describe('getLoopPoints', () => {
    it('returns a copy, not the internal reference', () => {
      engine.setLoop(10, 30);
      const a = engine.getLoopPoints()!;
      a.start = 999;
      const b = engine.getLoopPoints()!;
      expect(b.start).toBe(10);
    });
  });

  describe('pause/resume', () => {
    it('resumes after pause', () => {
      engine.setLoop(10, 30);
      engine.enable();
      expect(engine.isActive()).toBe(true);

      engine.pause();
      expect(engine.isActive()).toBe(false);

      engine.resume();
      expect(engine.isActive()).toBe(true);
    });

    it('resume is no-op when no loop points set', () => {
      engine.resume();
      expect(engine.isActive()).toBe(false);
    });
  });

  describe('enable idempotent', () => {
    it('calling enable twice does not create two rAF loops', () => {
      engine.setLoop(10, 30);
      engine.enable();
      expect(engine.isActive()).toBe(true);
      engine.enable(); // second call
      expect(engine.isActive()).toBe(true); // still active, no crash
    });
  });

  describe('setLoop edge cases', () => {
    it('accepts zero start time', () => {
      engine.setLoop(0, 30);
      expect(engine.getLoopPoints()).toEqual({ start: 0, end: 30 });
    });

    it('accepts very small range', () => {
      engine.setLoop(10, 10.1);
      expect(engine.getLoopPoints()).toEqual({ start: 10, end: 10.1 });
    });

    it('handles auto-swap with zero', () => {
      engine.setLoop(30, 0);
      expect(engine.getLoopPoints()).toEqual({ start: 0, end: 30 });
    });
  });

  describe('looping behavior', () => {
    it('seeks to start when reaching end', () => {
      engine.setLoop(10, 30);
      engine.enable();

      video.currentTime = 30;
      vi.advanceTimersByTime(16);
      expect(video.currentTime).toBe(10);
    });

    it('pauses when user seeks before start (manual seek detected)', () => {
      engine.setLoop(10, 30);
      engine.enable();

      // Direct time jump = manual seek → should pause per spec
      video.currentTime = 5;
      vi.advanceTimersByTime(16);
      expect(engine.isActive()).toBe(false);
      expect(video.currentTime).toBe(5); // not force-seeked back
    });

    it('does not seek when within range', () => {
      engine.setLoop(10, 30);
      engine.enable();

      video.currentTime = 20;
      vi.advanceTimersByTime(16);
      expect(video.currentTime).toBe(20);
    });

    it('stops ticking after disable', () => {
      engine.setLoop(10, 30);
      engine.enable();
      engine.disable();

      video.currentTime = 35;
      vi.advanceTimersByTime(16);
      expect(video.currentTime).toBe(35);
    });
  });

  describe('onLoop callback', () => {
    it('fires callback on each loop restart', () => {
      engine.setLoop(10, 20);
      engine.enable();

      const callback = vi.fn();
      engine.onLoop(callback);

      // First loop: reach end → seek to start + fire callback
      video.currentTime = 20;
      vi.advanceTimersByTime(16);
      expect(callback).toHaveBeenCalledTimes(1);

      // seekingTo guard polls until currentTime ≈ seek target.
      // Simulate seek landing (browser async)
      video.currentTime = 10;
      vi.advanceTimersByTime(16); // tick sees seekingTo done → resume normal checks

      // Play forward to end again
      video.currentTime = 20;
      vi.advanceTimersByTime(16);
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('returns cleanup function', () => {
      const cleanup = engine.onLoop(() => {});
      expect(typeof cleanup).toBe('function');
      cleanup();
    });
  });

  describe('pause/resume for manual seek', () => {
    it('pauses when user seeks outside range', () => {
      engine.setLoop(10, 30);
      engine.enable();

      video.currentTime = 50;
      vi.advanceTimersByTime(16);

      expect(engine.isActive()).toBe(false);
    });
  });
});
