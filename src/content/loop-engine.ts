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
  let seekingTo: number | null = null; // our own seek target — ignore bounds while seeking completes
  let waitingBufferSince: number | null = null; // timestamp when we started waiting for buffer after seek landed
  const BUFFER_WAIT_TIMEOUT_MS = 5000; // give up waiting after 5s to avoid infinite stall
  const loopCallbacks: Array<() => void> = [];

  function tick(): void {
    if (!active || !loopPoints) {
      rafId = null;
      return;
    }

    const t = video.currentTime;
    const { start, end } = loopPoints;
    const dt = Math.abs(t - lastTime);

    // If we're waiting for our own loop-seek to land, keep polling
    if (seekingTo !== null) {
      // Seek hasn't landed yet — currentTime still near old position
      if (Math.abs(t - seekingTo) > 0.3) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      // Seek landed — but YouTube's MSE may still be re-fetching the buffer.
      // Wait for readyState recovery so the video doesn't show a loading spinner.
      if (video.readyState < 3) {
        if (waitingBufferSince === null) {
          waitingBufferSince = performance.now();
        }
        // Timeout guard: if buffer never recovers, force resume anyway
        if (performance.now() - waitingBufferSince > BUFFER_WAIT_TIMEOUT_MS) {
          waitingBufferSince = null;
          seekingTo = null;
          lastTime = t;
          rafId = requestAnimationFrame(tick);
          return;
        }
        // If YouTube paused during rebuffer, try to nudge it to play
        if (video.paused) {
          video.play().catch(() => {});
        }
        rafId = requestAnimationFrame(tick);
        return;
      }

      // Buffer ready — resume normal checks
      waitingBufferSince = null;
      seekingTo = null;
      lastTime = t;
      rafId = requestAnimationFrame(tick);
      return;
    }

    // Detect manual seek (time jump > 0.5s) that lands far outside range
    if (dt > 0.5 && (t > end + 1 || t < start - 1)) {
      // User manually seeked outside loop range — pause, don't force back
      pause();
      return;
    }

    if (t >= end || t < start) {
      video.currentTime = start;
      seekingTo = start; // mark that we're waiting for this seek
      lastTime = start; // anchor to target so dt doesn't fire manual-seek detection
      waitingBufferSince = null; // reset buffer wait timer for the new seek
      loopCallbacks.forEach((cb) => cb());
      rafId = requestAnimationFrame(tick);
      return;
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
    lastTime = video.currentTime;
    seekingTo = null;
    rafId = requestAnimationFrame(tick);
  }

  function disable(): void {
    active = false;
    seekingTo = null;
    waitingBufferSince = null;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function pause(): void {
    active = false;
    seekingTo = null;
    waitingBufferSince = null;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function resume(): void {
    if (!loopPoints) return;
    active = true;
    lastTime = video.currentTime;
    seekingTo = null;
    waitingBufferSince = null;
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
