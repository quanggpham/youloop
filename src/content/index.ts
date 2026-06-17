import { createYouTubeDetector } from './youtube-detector';
import { createLoopEngine } from './loop-engine';
import { createTimelineUI } from './timeline-ui';
import { createMessageBus } from './message-bus';

interface AppState {
  loopActive: boolean;
}

async function init(): Promise<void> {
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

  ui.onDragMarker((_type, time) => {
    const points = engine.getLoopPoints();
    if (!points) return;
    if (_type === 'start') {
      engine.setLoop(time, points.end);
    } else {
      engine.setLoop(points.start, time);
    }
    const updated = engine.getLoopPoints();
    if (updated) {
      ui.updateMarkers(updated.start, updated.end);
      bus.saveLoop(videoId, updated.start, updated.end);
    }
  });

  // Handle SPA navigation — cleanup and re-init
  const cleanupNavigation = detector.onPageChange(() => {
    console.log('[SmartVideoLoop] Video changed, cleaning up');
    engine.disable();
    ui.destroy();
    cleanupNavigation();
    // Re-init for new video
    setTimeout(() => init(), 1000);
  });

  // Handle video end (natural) — seek back to start if looping
  video.addEventListener('ended', () => {
    if (state.loopActive && engine.getLoopPoints()) {
      const points = engine.getLoopPoints()!;
      video.currentTime = points.start;
      video.play();
    }
  });

  console.log('[SmartVideoLoop] Ready');
}

// Listen for keyboard shortcut messages from service worker
chrome.runtime.onMessage.addListener((message) => {
  if ((message as { type: string }).type === 'KEYBOARD_SHORTCUT') {
    const { action } = (message as { payload: { action: string } }).payload;
    switch (action) {
      case 'toggle_loop': {
        const toggleBtn = document.querySelector('[data-svl-action="toggle"]') as HTMLElement | null;
        toggleBtn?.click();
        break;
      }
      case 'set_start': {
        const setABtn = document.querySelector('[data-svl-action="set-start"]') as HTMLElement | null;
        setABtn?.click();
        break;
      }
      case 'set_end': {
        const setBBtn = document.querySelector('[data-svl-action="set-end"]') as HTMLElement | null;
        setBBtn?.click();
        break;
      }
    }
  }
});

// Start when DOM is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  init();
} else {
  window.addEventListener('DOMContentLoaded', init);
}
