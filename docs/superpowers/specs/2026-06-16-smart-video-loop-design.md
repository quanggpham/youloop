# Smart Video Loop — Design Spec

**Date:** 2026-06-16
**Status:** Draft
**Platform:** Chrome Extension (Manifest V3)
**Target:** YouTube (watch pages & embedded player)

---

## 1. Purpose

A Chrome extension that lets users select a time segment (A→B) on a YouTube video and loop that segment continuously. Users set start/end points via inline buttons in the YouTube player or by dragging markers on the progress bar. Loop settings persist per video ID in local storage.

---

## 2. Architecture

Micro-Modules Architecture — 5 independent modules with clear interfaces, bundled via ESBuild.

```
src/
├── content/                  # Content Script (injected into youtube.com)
│   ├── index.ts              # Entry point — wires all modules together
│   ├── youtube-detector.ts   # Detects watch page, video ID, player ready
│   ├── loop-engine.ts        # Core loop logic (rAF-based time monitor)
│   ├── timeline-ui.ts        # DOM injection: buttons, markers, time display
│   └── message-bus.ts        # chrome.runtime messaging wrapper
├── sw/
│   └── index.ts              # Service Worker — storage + keyboard shortcuts
├── shared/
│   └── types.ts              # Shared TypeScript types & message protocol
├── manifest.json
└── assets/
    └── icons/
```

### Build Output

- `dist/content.js` — single bundle from `src/content/`
- `dist/sw.js` — single bundle from `src/sw/`

---

## 3. Module Specifications

### 3.1 YouTube Detector

**Purpose:** Detect when the user is on a YouTube watch page, extract the video ID, and signal when the HTML5 video player is ready.

**Interface:**
```ts
interface YouTubeDetector {
  isWatchPage(): boolean;
  getVideoId(): string | null;
  onPageChange(callback: (videoId: string) => void): () => void; // returns cleanup
  waitForPlayer(): Promise<HTMLVideoElement>;
}
```

**Behavior:**
- Monitors URL changes via MutationObserver + `yt-navigate-finish` event (YouTube SPA navigation fires this custom event)
- Extracts video ID from `?v=` query param
- Polls for `<video>` element in the player container
- Emits lifecycle signals: `video-started`, `video-changed`, `player-unavailable`

**Edge cases:**
- YouTube Shorts → detect distinct URL pattern (`/shorts/`) and do NOT inject
- Embedded player (`youtube.com/embed/*`) → support this
- Playlist autoplay → detect when the video ID changes without a full page reload

---

### 3.2 Loop Engine

**Purpose:** Core looping logic. Monitors the video's `currentTime` and seeks back to the start when the end is reached.

**Interface:**
```ts
interface LoopEngine {
  setLoop(startSec: number, endSec: number): void;
  enable(): void;
  disable(): void;
  isActive(): boolean;
  getLoopPoints(): { start: number; end: number } | null;
  onLoop(callback: () => void): () => void;  // fires on each restart
}
```

**Algorithm:**
```
rAF loop (when enabled):
  t = video.currentTime
  if t >= endSec or t < startSec:
      video.currentTime = startSec  // seamless seek
  if enabled: requestAnimationFrame(tick)
```

**State machine:**

```
IDLE ──(set A&B)──→ READY ──(toggle on)──→ LOOPING
                                           │
                     ┌─────────────────────┘
                     ▼
                  PAUSED  (ad playing, user manually seeks outside range)
                     │
                     ▼
                  LOOPING (resumed when conditions clear)
```

**Edge cases:**
- **User manually seeks outside range:** Do not force-seek back. Pause the loop and wait for the user to re-enter the range, or let them re-enable manually.
- **Video ended naturally:** Seek to start and call `video.play()`.
- **Ad playing:** YouTube's ad player replaces the content player. Pause the loop; resume when the content player returns (detect via MutationObserver on the player container).
- **start > end (invalid input):** Auto-swap values. If start === end, reject and show tooltip error.
- **Very short loops (< 1 second):** Allow but display a warning.

---

### 3.3 Timeline UI

**Purpose:** Inject UI controls into the YouTube player and manage user interactions.

**Interface:**
```ts
interface TimelineUI {
  inject(playerContainer: HTMLElement): void;
  destroy(): void;
  updateMarkers(start: number, end: number): void;
  onSetStart(cb: (time: number) => void): () => void;
  onSetEnd(cb: (time: number) => void): () => void;
  onToggleLoop(cb: () => void): () => void;
  onDragMarker(type: 'start' | 'end', cb: (time: number) => void): () => void;
}
```

**Injected elements (positioned inside YouTube's player container):**

1. **Toggle Loop button** `[A↻B]` — next to YouTube's native controls. Shows active/inactive state.
2. **Set A button** `[⏺ Set A]` — captures current video time as loop start.
3. **Set B button** `[⏹ Set B]` — captures current video time as loop end.
4. **Progress bar markers** — two draggable vertical bars overlaid on YouTube's progress bar. The region between them is highlighted.
5. **Time display** `[1:30 — 3:45]` — small text showing the current loop range near the controls.

**Visual style:**
- Accent color: `#FF4081` (pink) — contrasts well with YouTube's red
- Markers: 3px wide vertical bars, draggable horizontally
- Loop region highlight: semi-transparent pink overlay on the progress bar between A and B
- Buttons: compact, icon-only with tooltips. Match YouTube's control bar aesthetic.

**User flows:**
- **Set via buttons:** User seeks to desired time → clicks Set A → seeks to end → clicks Set B
- **Set via drag:** User drags the A marker left/right on the progress bar. Same for B.
- **Activate loop:** Clicks the toggle button (or uses keyboard shortcut)
- **Adjust markers while looping:** User can drag markers during active loop — loop engine picks up new positions on next tick

---

### 3.4 Storage Manager

**Purpose:** Persist loop settings per video ID using `chrome.storage.local` via the Service Worker.

**Interface:**
```ts
interface StorageManager {
  saveLoop(videoId: string, start: number, end: number): Promise<void>;
  loadLoop(videoId: string): Promise<{ start: number; end: number } | null>;
  deleteLoop(videoId: string): Promise<void>;
  getAllLoops(): Promise<Record<string, { start: number; end: number; savedAt: number }>>;
}
```

**Storage schema:**
```json
{
  "loops": {
    "dQw4w9WgXcQ": { "start": 90.5, "end": 225.3, "savedAt": 1706000000 },
    "9bZkp7q19f0": { "start": 30.0, "end": 60.0, "savedAt": 1706000500 }
  }
}
```

**Design decisions:**
- Keyed by video ID for O(1) lookup
- `savedAt` timestamp for future cleanup policy (e.g., auto-delete entries older than 6 months)
- Auto-save on every Set A / Set B action — no manual save button
- Reads happen via Service Worker messaging (not direct from content script)

---

### 3.5 Message Bus

**Purpose:** Typed wrapper around `chrome.runtime.sendMessage` for communication between Content Script and Service Worker.

**Message protocol:**

```ts
// Content Script → Service Worker
type OutgoingMessage =
  | { type: 'LOOP_SAVE'; payload: { videoId: string; start: number; end: number } }
  | { type: 'LOOP_LOAD'; payload: { videoId: string } }
  | { type: 'LOOP_DELETE'; payload: { videoId: string } };

// Service Worker → Content Script
type IncomingMessage =
  | { type: 'LOOP_LOADED'; payload: { videoId: string; loop: { start: number; end: number } | null } }
  | { type: 'LOOP_SAVED'; payload: { videoId: string; ok: boolean } };
```

**Error handling:**
- 3-second timeout per message → resolve with null/error on timeout
- Service Worker terminated by Chrome (idle) → retry once; SW auto-restarts
- All operations are local — no network dependency

---

### 3.6 Service Worker

**Purpose:** Handle storage operations and global keyboard shortcuts.

**Responsibilities:**
- Receive storage messages from content script → read/write `chrome.storage.local`
- Register keyboard shortcuts via `chrome.commands`:
  - `Ctrl+Shift+L` → toggle loop on/off
  - `Ctrl+Shift+A` → set loop start
  - `Ctrl+Shift+B` → set loop end
- Broadcast keyboard shortcut actions to the active tab's content script

---

## 4. Manifest V3 Configuration

```json
{
  "manifest_version": 3,
  "name": "Smart Video Loop",
  "version": "1.0.0",
  "description": "Loop any segment of a YouTube video seamlessly",
  "permissions": ["storage"],
  "host_permissions": ["*://*.youtube.com/*"],
  "content_scripts": [{
    "matches": ["*://*.youtube.com/*"],
    "js": ["dist/content.js"],
    "run_at": "document_end"
  }],
  "background": {
    "service_worker": "dist/sw.js"
  },
  "commands": {
    "toggle_loop": { "suggested_key": { "default": "Ctrl+Shift+L" }, "description": "Toggle loop" },
    "set_start": { "suggested_key": { "default": "Ctrl+Shift+A" }, "description": "Set loop start" },
    "set_end": { "suggested_key": { "default": "Ctrl+Shift+B" }, "description": "Set loop end" }
  },
  "icons": {
    "16": "assets/icons/icon-16.png",
    "48": "assets/icons/icon-48.png",
    "128": "assets/icons/icon-128.png"
  }
}
```

---

## 5. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| User opens YouTube Shorts | Detector skips injection (different DOM) |
| Ad plays during loop | Pause loop, resume when ad ends |
| User manually seeks outside loop range | Do not force back. Loop stays paused until user re-enters range or re-enables. |
| Very short loop (< 1s) | Allow, but show warning toast |
| Start > End set by user | Auto-swap; if equal, reject |
| YouTube SPA navigation (clicking another video) | Detector fires `video-changed`. UI re-injects. Storage loads new video's settings. |
| Service Worker terminated (idle) | Message Bus retries once; SW restarts automatically |
| Player element missing (broken YouTube layout) | Detector times out after 10s, logs warning, no injection |
| Multiple tabs with same video | Each tab operates independently. Last save wins in storage. |
| Disabled extension / uninstalled | All UI is injected — destruction is automatic on page reload |

---

## 6. Testing Strategy

| Level | Tool | Coverage |
|-------|------|----------|
| Unit | Vitest | youtube-detector, loop-engine, storage schema, message types |
| Integration | Vitest + jsdom | timeline-ui DOM manipulation, message bus send/receive |
| E2E | Playwright | Full flow on real YouTube: navigate → set A → set B → verify loop → reload → verify persistence |

**Key test scenarios:**
1. Loop engine correctly seeks at end boundary
2. Loop engine respects manual user seek
3. Storage round-trip (save → reload → verify)
4. Timeline markers render at correct positions on progress bar
5. SPA navigation triggers full lifecycle reset
6. Ad interruption pauses and resumes loop

---

## 7. Future Considerations (Out of Scope for MVP)

- Support for Vimeo, Dailymotion, Facebook Video
- Chrome sync storage for cross-device sync
- Multiple saved loops per video (playlist of loops)
- Speed control within loop (0.5x, 1.5x, 2x)
- Export loop as GIF/webm clip
- Share loop link (YouTube timestamp URLs)
- Loop counter / statistics
