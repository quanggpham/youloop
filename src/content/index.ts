import { createYouTubeDetector } from './youtube-detector';
import { createLoopEngine } from './loop-engine';
import { createTimelineUI } from './timeline-ui';
import { createMessageBus } from './message-bus';

interface AppState {
  loopActive: boolean;
}

let cleanupCurrent: Array<() => void> = [];
let lastVideoId: string | null = null;
let navTimeout: ReturnType<typeof setTimeout> | null = null;
let extensionEnabled = true; // mirrors popup toggle

function cleanup(): void {
  cleanupCurrent.forEach((fn) => fn());
  cleanupCurrent = [];
}

export async function init(): Promise<void> {
  if (!extensionEnabled) return;
  const detector = createYouTubeDetector();

  // Only run on watch pages
  if (!detector.isWatchPage()) {
    console.log('[SmartVideoLoop] Not a watch page, skipping');
    return;
  }

  const videoId = detector.getVideoId();
  if (!videoId) {
    console.log('[SmartVideoLoop] No video ID found');
    return;
  }

  console.log(`[SmartVideoLoop] Initializing for video: ${videoId}`);

  // Acquire player
  let video: HTMLVideoElement;
  try {
    video = await detector.waitForPlayer();
  } catch (err) {
    console.warn('[SmartVideoLoop] Player not found:', err);
    return;
  }

  // Find player container for UI injection
  const playerContainer = document.getElementById('movie_player');
  if (!playerContainer) {
    console.warn('[SmartVideoLoop] Player container not found');
    return;
  }

  // Create modules
  const engine = createLoopEngine(video);
  const ui = createTimelineUI();
  const bus = createMessageBus();

  const state: AppState = { loopActive: false };

  // Inject UI
  ui.inject(playerContainer);

  // Load saved loop points
  const saved = await bus.loadLoop(videoId);
  if (saved) {
    engine.setLoop(saved.start, saved.end);
    ui.updateMarkers(saved.start, saved.end);
    console.log(`[SmartVideoLoop] Loaded saved loop: ${saved.start} — ${saved.end}`);
  }

  // Wire UI events → Engine + Storage

  ui.onSetStart((time) => {
    const existing = engine.getLoopPoints();
    engine.setLoop(time, existing?.end ?? video.duration);
    const points = engine.getLoopPoints();
    if (points) {
      ui.updateMarkers(points.start, points.end);
      bus.saveLoop(videoId, points.start, points.end);
    }
  });

  ui.onSetEnd((time) => {
    const existing = engine.getLoopPoints();
    engine.setLoop(existing?.start ?? 0, time);
    const points = engine.getLoopPoints();
    if (points) {
      ui.updateMarkers(points.start, points.end);
      bus.saveLoop(videoId, points.start, points.end);
    }
  });

  ui.onToggleLoop(() => {
    if (state.loopActive) {
      engine.disable();
      state.loopActive = false;
      ui.setActive(false);
    } else {
      try {
        engine.enable();
        state.loopActive = true;
        ui.setActive(true);
      } catch (err) {
        console.warn('[SmartVideoLoop] Cannot enable loop:', err);
      }
    }
  });

  // onDragMarker signature: onDragMarker(type: 'start' | 'end', callback: (time: number) => void)
  ui.onDragMarker('start', (time) => {
    const points = engine.getLoopPoints();
    if (!points) return;
    engine.setLoop(time, points.end);
    const updated = engine.getLoopPoints();
    if (updated) {
      ui.updateMarkers(updated.start, updated.end);
      bus.saveLoop(videoId, updated.start, updated.end);
    }
  });

  ui.onDragMarker('end', (time) => {
    const points = engine.getLoopPoints();
    if (!points) return;
    engine.setLoop(points.start, time);
    const updated = engine.getLoopPoints();
    if (updated) {
      ui.updateMarkers(updated.start, updated.end);
      bus.saveLoop(videoId, updated.start, updated.end);
    }
  });

  // Handle video end (natural) — seek back to start if looping.
  // This is a fallback; the loop engine's rAF tick normally catches t >= end first.
  // We wait for readyState >= 3 to avoid the YouTube loading spinner on seek.
  function onVideoEnded(): void {
    if (state.loopActive && engine.getLoopPoints()) {
      const points = engine.getLoopPoints()!;
      video.currentTime = points.start;
      // Wait for buffer before playing to avoid loading spinner
      function waitThenPlay(): void {
        if (video.readyState >= 3) {
          video.play().catch(() => {});
          return;
        }
        if (video.paused) video.play().catch(() => {});
        requestAnimationFrame(waitThenPlay);
      }
      waitThenPlay();
    }
  }
  video.addEventListener('ended', onVideoEnded);

  cleanupCurrent = [
    () => engine.disable(),
    () => ui.destroy(),
    () => video.removeEventListener('ended', onVideoEnded),
  ];
  lastVideoId = videoId;

  console.log('[SmartVideoLoop] Ready');
}

// ── Messages from popup ─────────────────────────────
// Keyboard shortcuts have been removed — users interact via mouse (buttons + drag markers).
chrome.runtime.onMessage.addListener((message) => {
  const msg = message as { type: string; payload?: Record<string, unknown> };

  if (msg.type === 'SET_ENABLED') {
    const enabled = (msg.payload as { enabled: boolean }).enabled;
    extensionEnabled = enabled;
    console.log(`[SmartVideoLoop] Extension ${enabled ? 'enabled' : 'disabled'}`);

    if (enabled) {
      // Re-init on current page
      cleanup();
      init();
    } else {
      cleanup();
      lastVideoId = null;
    }
  }
});

// Listen for SPA navigation — independent of init(), ensures we trigger on
// first navigation from homepage → watch page (where init() would have been skipped).
// Debounced: YouTube fires yt-navigate-finish multiple times per navigation.
window.addEventListener('yt-navigate-finish', () => {
  if (navTimeout) clearTimeout(navTimeout);
  navTimeout = setTimeout(async () => {
    navTimeout = null;
    if (!extensionEnabled) return;
    const detector = createYouTubeDetector();
    if (!detector.isWatchPage()) return;
    const id = detector.getVideoId();
    if (!id) return;
    if (id === lastVideoId) return; // ignore same-video navigation events

    console.log(`[SmartVideoLoop] SPA navigation to watch page: ${id}`);
    cleanup();
    await init();
  }, 300);
});

// Start when DOM is ready.
// We wrap in a function so tests can mock chrome.* before it runs.
export function start(): void {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    window.addEventListener('DOMContentLoaded', init);
  }
}

// In production the module auto-starts. Tests import { start } and call it after mocking.
start();
