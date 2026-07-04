# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build        # Bundle via ESBuild → dist/content.js + dist/sw.js
npm run dev          # Watch mode
npm test             # Run all Vitest unit tests (53 tests, jsdom env)
npm run test:e2e     # Playwright E2E tests (requires extension loaded in Chromium)
npx vitest run src/path/to/file.test.ts  # Run a single test file
```

## Architecture

Chrome Extension (Manifest V3) that injects loop controls into YouTube's player.

**Two entry points** bundled by ESBuild:
- `src/content/index.ts` → `dist/content.js` (injected into youtube.com)
- `src/sw/index.ts` → `dist/sw.js` (service worker)

**Content Script modules** (factory functions, no classes):

| Module | Responsibility |
|--------|---------------|
| `youtube-detector.ts` | Detect watch/embed pages, extract video ID, wait for `<video>` element, handle SPA navigation via `yt-navigate-finish` |
| `loop-engine.ts` | rAF-based loop monitor — checks `video.currentTime` each frame, seeks to start when past end. Detects manual seek outside range and pauses. |
| `timeline-ui.ts` | DOM injection into `#movie_player`: control bar (toggle + Set A/B buttons + time display) and draggable markers on `.ytp-progress-bar` |
| `message-bus.ts` | Typed wrapper around `chrome.runtime.sendMessage` with 3s timeout, handles `LOOP_SAVE/LOAD/DELETE` |
| `index.ts` | Wires detector → engine → UI → bus, handles SPA re-init, keyboard shortcuts from SW |

**Service Worker modules:**
| Module | Responsibility |
|--------|---------------|
| `storage.ts` | Pure async functions for `chrome.storage.local` — `handleSaveLoop/loadLoop/deleteLoop` keyed by video ID |
| `index.ts` | Routes messages to storage handlers, forwards `chrome.commands` shortcuts to content script |

**Shared:** `shared/types.ts` — `LoopConfig`, `LoopStore`, `OutgoingMessage`, `IncomingMessage` types

## Key Design Patterns

- **Factory functions only** — `createYouTubeDetector()`, `createLoopEngine(video)`, `createTimelineUI()`, `createMessageBus()` — no classes
- **Cleanup via returned disposers** — `onPageChange(cb)` returns `() => void`, `setupDrag()` returns cleanup
- **Vitest with jsdom** — all unit tests mock `chrome.*` API and YouTube DOM structures
- **`[SmartVideoLoop]` log prefix** for debugging in YouTube's console
- **UI uses YouTube-native colors** (`rgb(255,0,0)` red, `#FFF`, `rgba(0,0,0,0.8)` bg) to blend in
- **SPA handling:** content script re-initializes on `yt-navigate-finish`; guards against re-init on same video ID

## Testing

- Unit tests use fake timers (`vi.useFakeTimers()`) for loop engine, mock `chrome.storage.local` for storage
- E2E tests in `e2e/` require the extension to be loaded as unpacked in Playwright's Chromium
- `vitest.config.ts` excludes `e2e/**` from Vitest runs
