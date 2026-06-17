export interface LoopEngine {
  setLoop(startSec: number, endSec: number): void;
  enable(): void;
  disable(): void;
  isActive(): boolean;
  getLoopPoints(): { start: number; end: number } | null;
  onLoop(callback: () => void): () => void;
  pause(): void;
  resume(): void;
}

export function createLoopEngine(video: HTMLVideoElement): LoopEngine {
  let loopPoints: { start: number; end: number } | null = null;
  let active = false;
  let rafId: number | null = null;
  let lastTime = 0;
  const loopCallbacks: Array<() => void> = [];

  function tick(): void {
    if (!active || !loopPoints) {
      rafId = null;
      return;
    }

    const t = video.currentTime;
    const { start, end } = loopPoints;
    const dt = Math.abs(t - lastTime);

    // Detect manual seek (time jump > 0.5s) that lands far outside range
    if (dt > 0.5 && (t > end + 1 || t < start - 1)) {
      // User manually seeked outside loop range — pause, don't force back
      pause();
      return;
    }

    if (t >= end || t < start) {
      video.currentTime = start;
      loopCallbacks.forEach((cb) => cb());
    }

    lastTime = video.currentTime;
    rafId = requestAnimationFrame(tick);
  }

  function setLoop(startSec: number, endSec: number): void {
    if (startSec === endSec) {
      throw new Error('Start and end cannot be equal');
    }
    if (startSec > endSec) {
      [startSec, endSec] = [endSec, startSec]; // auto-swap
    }
    loopPoints = { start: startSec, end: endSec };
  }

  function enable(): void {
    if (!loopPoints) {
      throw new Error('Cannot enable loop: no loop points set');
    }
    if (active) return;
    active = true;
    lastTime = video.currentTime; // anchor to current time to avoid false manual-seek detection
    rafId = requestAnimationFrame(tick);
  }

  function disable(): void {
    active = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function pause(): void {
    active = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function resume(): void {
    if (!loopPoints) return;
    active = true;
    rafId = requestAnimationFrame(tick);
  }

  function isActive(): boolean {
    return active;
  }

  function getLoopPoints(): { start: number; end: number } | null {
    return loopPoints ? { ...loopPoints } : null;
  }

  function onLoop(callback: () => void): () => void {
    loopCallbacks.push(callback);
    return () => {
      const idx = loopCallbacks.indexOf(callback);
      if (idx >= 0) loopCallbacks.splice(idx, 1);
    };
  }

  return { setLoop, enable, disable, isActive, getLoopPoints, onLoop, pause, resume };
}
