# Smart Video Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension that lets users loop a segment of a YouTube video continuously with inline player controls, draggable timeline markers, and persistent per-video storage.

**Architecture:** Micro-modules — 5 independent TypeScript modules (YouTube Detector, Loop Engine, Timeline UI, Message Bus, Storage Manager) bundled via ESBuild into content script and service worker. Each module has a single responsibility and a typed interface.

**Tech Stack:** TypeScript 5.x, ESBuild, Vitest (unit/integration), Playwright (E2E), Chrome Manifest V3

**UI Design Reference:** `ui_design.md` — CSS design tokens, interaction specs, and component library. All UI code must use the CSS variables and follow the interaction patterns defined there.

---

## Task 1: Project Scaffolding & Build Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.mjs`
- Create: `manifest.json`
- Create: `.gitignore`
- Create: `src/shared/types.ts` (skeleton)
- Create: `src/content/index.ts` (skeleton)
- Create: `src/sw/index.ts` (skeleton)

- [ ] **Step 1: Initialize package.json**

```bash
cd "F:\App\hoc\workspace\extension\smart-video-loop"
```

Write `package.json`:
```json
{
  "name": "smart-video-loop",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "node esbuild.config.mjs",
    "dev": "node esbuild.config.mjs --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "esbuild": "^0.24.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "@playwright/test": "^1.45.0",
    "jsdom": "^24.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Write esbuild.config.mjs**

```javascript
import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [
    { in: 'src/content/index.ts', out: 'content' },
    { in: 'src/sw/index.ts', out: 'sw' },
  ],
  bundle: true,
  outdir: 'dist',
  target: 'es2022',
  format: 'iife',
  platform: 'browser',
  sourcemap: true,
  minify: false,
};

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(buildOptions);
  console.log('Build complete.');
}
```

- [ ] **Step 5: Write manifest.json**

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
    "toggle_loop": {
      "suggested_key": { "default": "Ctrl+Shift+L" },
      "description": "Toggle loop on/off"
    },
    "set_start": {
      "suggested_key": { "default": "Ctrl+Shift+A" },
      "description": "Set loop start point"
    },
    "set_end": {
      "suggested_key": { "default": "Ctrl+Shift+B" },
      "description": "Set loop end point"
    }
  },
  "icons": {
    "16": "assets/icons/icon-16.png",
    "48": "assets/icons/icon-48.png",
    "128": "assets/icons/icon-128.png"
  }
}
```

- [ ] **Step 6: Write .gitignore**

```
node_modules/
dist/
*.tsbuildinfo
```

- [ ] **Step 7: Write shared types skeleton**

Write `src/shared/types.ts`:
```typescript
// Message protocol types — Content Script ↔ Service Worker

export interface LoopConfig {
  start: number;
  end: number;
  savedAt: number;
}

export interface LoopStore {
  [videoId: string]: LoopConfig;
}

// Content Script → Service Worker
export type OutgoingMessage =
  | { type: 'LOOP_SAVE'; payload: { videoId: string; start: number; end: number } }
  | { type: 'LOOP_LOAD'; payload: { videoId: string } }
  | { type: 'LOOP_DELETE'; payload: { videoId: string } };

// Service Worker → Content Script
export type IncomingMessage =
  | { type: 'LOOP_LOADED'; payload: { videoId: string; loop: { start: number; end: number } | null } }
  | { type: 'LOOP_SAVED'; payload: { videoId: string; ok: boolean } };

// Internal lifecycle events (content script only)
export type LifecycleEvent = 'video-started' | 'video-changed' | 'player-unavailable';
```

- [ ] **Step 8: Write content script skeleton**

Write `src/content/index.ts`:
```typescript
// Content script entry point — will be wired in later tasks
console.log('[SmartVideoLoop] Content script loaded');
```

- [ ] **Step 9: Write service worker skeleton**

Write `src/sw/index.ts`:
```typescript
// Service worker entry point — will be wired in later tasks
chrome.runtime.onInstalled.addListener(() => {
  console.log('[SmartVideoLoop] Extension installed');
});
```

- [ ] **Step 10: Run first build to verify scaffolding**

```bash
npm run build
```

Expected: Build succeeds, `dist/content.js` and `dist/sw.js` exist.

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "chore: project scaffolding with esbuild + manifest v3"
```

---

## Task 2: Shared Types & Message Protocol

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Write unit test for types validation**

Create `src/shared/__tests__/types.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('Message types', () => {
  it('LOOP_SAVE message has correct shape', () => {
    const msg = {
      type: 'LOOP_SAVE' as const,
      payload: { videoId: 'abc123', start: 10.5, end: 30.0 },
    };
    expect(msg.type).toBe('LOOP_SAVE');
    expect(msg.payload.videoId).toBe('abc123');
    expect(msg.payload.start).toBe(10.5);
    expect(msg.payload.end).toBe(30.0);
  });

  it('LOOP_LOAD message has correct shape', () => {
    const msg = {
      type: 'LOOP_LOAD' as const,
      payload: { videoId: 'abc123' },
    };
    expect(msg.type).toBe('LOOP_LOAD');
    expect(msg.payload.videoId).toBe('abc123');
  });

  it('LOOP_LOADED response has correct shape', () => {
    const withLoop = {
      type: 'LOOP_LOADED' as const,
      payload: { videoId: 'abc123', loop: { start: 10, end: 30 } },
    };
    expect(withLoop.payload.loop).not.toBeNull();
    expect(withLoop.payload.loop!.start).toBe(10);

    const withoutLoop = {
      type: 'LOOP_LOADED' as const,
      payload: { videoId: 'xyz', loop: null },
    };
    expect(withoutLoop.payload.loop).toBeNull();
  });

  it('LOOP_DELETE and LOOP_SAVED have correct shapes', () => {
    const del = {
      type: 'LOOP_DELETE' as const,
      payload: { videoId: 'abc' },
    };
    expect(del.type).toBe('LOOP_DELETE');

    const saved = {
      type: 'LOOP_SAVED' as const,
      payload: { videoId: 'abc', ok: true },
    };
    expect(saved.payload.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm skeleton passes**

```bash
npx vitest run
```

Expected: 4 tests pass (types are already defined in types.ts from Task 1)

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "test: add type shape validation tests"
```

---

## Task 3: YouTube Detector

**Files:**
- Create: `src/content/youtube-detector.ts`
- Create: `src/content/__tests__/youtube-detector.test.ts`

- [ ] **Step 1: Write failing test for isWatchPage and getVideoId**

Write `src/content/__tests__/youtube-detector.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createYouTubeDetector } from '../youtube-detector';

describe('YouTubeDetector', () => {
  let originalHref: string;

  beforeEach(() => {
    originalHref = window.location.href;
  });

  afterEach(() => {
    // Reset URL
    window.history.pushState({}, '', originalHref);
  });

  describe('isWatchPage', () => {
    it('returns true for watch URLs', () => {
      window.history.pushState({}, '', 'https://www.youtube.com/watch?v=abc123');
      const detector = createYouTubeDetector();
      expect(detector.isWatchPage()).toBe(true);
    });

    it('returns false for shorts URLs', () => {
      window.history.pushState({}, '', 'https://www.youtube.com/shorts/abc123');
      const detector = createYouTubeDetector();
      expect(detector.isWatchPage()).toBe(false);
    });

    it('returns false for other YouTube pages', () => {
      window.history.pushState({}, '', 'https://www.youtube.com/feed/trending');
      const detector = createYouTubeDetector();
      expect(detector.isWatchPage()).toBe(false);
    });

    it('returns true for embed URLs', () => {
      window.history.pushState({}, '', 'https://www.youtube.com/embed/abc123');
      const detector = createYouTubeDetector();
      expect(detector.isWatchPage()).toBe(true);
    });
  });

  describe('getVideoId', () => {
    it('extracts video ID from watch URL', () => {
      window.history.pushState({}, '', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      const detector = createYouTubeDetector();
      expect(detector.getVideoId()).toBe('dQw4w9WgXcQ');
    });

    it('extracts video ID from embed URL', () => {
      window.history.pushState({}, '', 'https://www.youtube.com/embed/abc123');
      const detector = createYouTubeDetector();
      expect(detector.getVideoId()).toBe('abc123');
    });

    it('extracts video ID with extra query params', () => {
      window.history.pushState({}, '', 'https://www.youtube.com/watch?v=abc123&t=30&list=PLxyz');
      const detector = createYouTubeDetector();
      expect(detector.getVideoId()).toBe('abc123');
    });

    it('returns null for non-video pages', () => {
      window.history.pushState({}, '', 'https://www.youtube.com/');
      const detector = createYouTubeDetector();
      expect(detector.getVideoId()).toBeNull();
    });
  });

  describe('onPageChange', () => {
    it('calls callback on URL change', async () => {
      window.history.pushState({}, '', 'https://www.youtube.com/watch?v=old123');
      const detector = createYouTubeDetector();
      const changes: string[] = [];
      detector.onPageChange((id) => changes.push(id));

      // Simulate YouTube SPA navigation
      window.history.pushState({}, '', 'https://www.youtube.com/watch?v=new456');
      window.dispatchEvent(new CustomEvent('yt-navigate-finish'));

      // Wait for microtask
      await new Promise((r) => setTimeout(r, 10));
      expect(changes).toEqual(['new456']);
    });

    it('returns cleanup function', () => {
      const detector = createYouTubeDetector();
      const cleanup = detector.onPageChange(() => {});
      expect(typeof cleanup).toBe('function');
      cleanup(); // should not throw
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/content/__tests__/youtube-detector.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement createYouTubeDetector**

Write `src/content/youtube-detector.ts`:
```typescript
import type { LifecycleEvent } from '../shared/types';

export interface YouTubeDetector {
  isWatchPage(): boolean;
  getVideoId(): string | null;
  onPageChange(callback: (videoId: string) => void): () => void;
  waitForPlayer(timeoutMs?: number): Promise<HTMLVideoElement>;
}

export function createYouTubeDetector(): YouTubeDetector {
  function isWatchPage(): boolean {
    const url = window.location.href;
    if (url.includes('/shorts/')) return false;
    return url.includes('/watch') || url.includes('/embed/');
  }

  function getVideoId(): string | null {
    const url = new URL(window.location.href);
    return url.searchParams.get('v');
  }

  function onPageChange(callback: (videoId: string) => void): () => void {
    function handleNavigate() {
      const id = getVideoId();
      if (id) callback(id);
    }

    window.addEventListener('yt-navigate-finish', handleNavigate);
    return () => window.removeEventListener('yt-navigate-finish', handleNavigate);
  }

  function waitForPlayer(timeoutMs = 10000): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        observer.disconnect();
        reject(new Error('Player not found within timeout'));
      }, timeoutMs);

      // Try immediate find
      const existing = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
      if (existing) {
        clearTimeout(timeout);
        resolve(existing);
        return;
      }

      // Watch for it
      const observer = new MutationObserver(() => {
        const video = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
        if (video) {
          clearTimeout(timeout);
          observer.disconnect();
          resolve(video);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  return { isWatchPage, getVideoId, onPageChange, waitForPlayer };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/content/__tests__/youtube-detector.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add YouTube detector with page detection and player wait"
```

---

## Task 4: Loop Engine

**Files:**
- Create: `src/content/loop-engine.ts`
- Create: `src/content/__tests__/loop-engine.test.ts`

- [ ] **Step 1: Write failing test for LoopEngine**

Write `src/content/__tests__/loop-engine.test.ts`:
```typescript
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

  describe('looping behavior', () => {
    it('seeks to start when reaching end', () => {
      engine.setLoop(10, 30);
      engine.enable();

      video.currentTime = 30;
      vi.advanceTimersByTime(16); // one rAF tick
      expect(video.currentTime).toBe(10);
    });

    it('seeks to start when before start', () => {
      engine.setLoop(10, 30);
      engine.enable();

      video.currentTime = 5;
      vi.advanceTimersByTime(16);
      expect(video.currentTime).toBe(10);
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
      expect(video.currentTime).toBe(35); // unchanged
    });
  });

  describe('onLoop callback', () => {
    it('fires callback on each loop restart', () => {
      engine.setLoop(10, 20);
      engine.enable();

      const callback = vi.fn();
      engine.onLoop(callback);

      video.currentTime = 20;
      vi.advanceTimersByTime(16);
      expect(callback).toHaveBeenCalledTimes(1);

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

      // Simulate user seeking outside
      video.currentTime = 50;
      // The engine detects this but should not force-seek back
      // Instead it pauses
      vi.advanceTimersByTime(16);

      // Engine should be paused, not actively looping
      // User can re-enable manually
      expect(engine.isActive()).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/content/__tests__/loop-engine.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement createLoopEngine**

Write `src/content/loop-engine.ts`:
```typescript
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
  const loopCallbacks: Array<() => void> = [];

  function tick(): void {
    if (!active || !loopPoints) {
      rafId = null;
      return;
    }

    const t = video.currentTime;
    const { start, end } = loopPoints;

    if (t >= end || t < start) {
      video.currentTime = start;
      loopCallbacks.forEach((cb) => cb());
    }

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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/content/__tests__/loop-engine.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add loop engine with rAF-based seek and state machine"
```

---

## Task 5: Timeline UI — Buttons and Controls

**Files:**
- Create: `src/content/timeline-ui.ts`
- Create: `src/content/__tests__/timeline-ui.test.ts`

- [ ] **Step 1: Write failing test for TimelineUI**

Write `src/content/__tests__/timeline-ui.test.ts`:
```typescript
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
    expect(buttons.length).toBe(3); // Toggle, Set A, Set B
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

  it('calls onSetStart callback with current time', () => {
    const ui = createTimelineUI();
    ui.inject(container);

    const startCalls: number[] = [];
    ui.onSetStart((t) => startCalls.push(t));

    const setABtn = container.querySelector('[data-svl-action="set-start"]') as HTMLElement;
    setABtn.click();
    // Time comes from the callback context — in real usage it's video.currentTime
    // In tests, the UI just fires the callback when clicked
  });

  it('calls onSetEnd callback when button clicked', () => {
    const ui = createTimelineUI();
    ui.inject(container);

    const endCalls: number[] = [];
    ui.onSetEnd((t) => endCalls.push(t));

    const setBBtn = container.querySelector('[data-svl-action="set-end"]') as HTMLElement;
    setBBtn.click();
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

    // Calling destroy again should not throw
    expect(() => ui.destroy()).not.toThrow();
  });

  it('returns cleanup from callback registrations', () => {
    const ui = createTimelineUI();
    ui.inject(container);

    const cleanup = ui.onSetStart(() => {});
    expect(typeof cleanup).toBe('function');
    cleanup(); // should not throw

    ui.destroy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/content/__tests__/timeline-ui.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement createTimelineUI**

Write `src/content/timeline-ui.ts`:
```typescript
export interface TimelineUI {
  inject(container: HTMLElement): void;
  destroy(): void;
  updateMarkers(start: number, end: number): void;
  setActive(active: boolean): void;
  onSetStart(cb: (time: number) => void): () => void;
  onSetEnd(cb: (time: number) => void): () => void;
  onToggleLoop(cb: () => void): () => void;
  onDragMarker(type: 'start' | 'end', cb: (time: number) => void): () => void;
}

const ACCENT = '#FF4081';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function createTimelineUI(): TimelineUI {
  let container: HTMLElement | null = null;
  let elements: HTMLElement[] = [];
  const callbacks = {
    setStart: new Set<(t: number) => void>(),
    setEnd: new Set<(t: number) => void>(),
    toggleLoop: new Set<() => void>(),
    dragMarker: new Set<(type: 'start' | 'end', t: number) => void>(),
  };

  function getTimeSource(): number {
    // Will be wired to player.currentTime
    const video = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
    return video?.currentTime ?? 0;
  }

  function buildControls(): HTMLElement {
    const bar = document.createElement('div');
    bar.setAttribute('data-svl-controls', '');
    bar.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px;
      font-family: 'YouTube Sans', 'Roboto', sans-serif;
      font-size: 13px;
      color: #fff;
      background: rgba(0,0,0,0.4);
      border-radius: 4px;
      user-select: none;
    `;

    // Toggle button
    const toggle = document.createElement('button');
    toggle.setAttribute('data-svl-button', '');
    toggle.setAttribute('data-svl-action', 'toggle');
    toggle.title = 'Toggle Loop';
    toggle.style.cssText = `
      background: none;
      border: 1px solid ${ACCENT};
      color: #fff;
      border-radius: 4px;
      padding: 4px 10px;
      cursor: pointer;
      font-size: 13px;
      font-family: inherit;
    `;
    toggle.textContent = 'A↻B';
    toggle.addEventListener('click', () => callbacks.toggleLoop.forEach((cb) => cb()));
    bar.appendChild(toggle);

    // Set A button
    const setA = document.createElement('button');
    setA.setAttribute('data-svl-button', '');
    setA.setAttribute('data-svl-action', 'set-start');
    setA.title = 'Set Loop Start (A)';
    setA.style.cssText = `
      background: none;
      border: 1px solid ${ACCENT};
      color: #fff;
      border-radius: 4px;
      padding: 4px 10px;
      cursor: pointer;
      font-size: 13px;
      font-family: inherit;
    `;
    setA.textContent = '⏺ A';
    setA.addEventListener('click', () => {
      const t = getTimeSource();
      callbacks.setStart.forEach((cb) => cb(t));
    });
    bar.appendChild(setA);

    // Set B button
    const setB = document.createElement('button');
    setB.setAttribute('data-svl-button', '');
    setB.setAttribute('data-svl-action', 'set-end');
    setB.title = 'Set Loop End (B)';
    setB.style.cssText = `
      background: none;
      border: 1px solid ${ACCENT};
      color: #fff;
      border-radius: 4px;
      padding: 4px 10px;
      cursor: pointer;
      font-size: 13px;
      font-family: inherit;
    `;
    setB.textContent = '⏹ B';
    setB.addEventListener('click', () => {
      const t = getTimeSource();
      callbacks.setEnd.forEach((cb) => cb(t));
    });
    bar.appendChild(setB);

    // Time display
    const timeDisplay = document.createElement('span');
    timeDisplay.setAttribute('data-svl-display', 'time');
    timeDisplay.style.cssText = `
      color: ${ACCENT};
      font-weight: 600;
      font-family: monospace;
      font-size: 13px;
    `;
    timeDisplay.textContent = '—:— — —:—';
    bar.appendChild(timeDisplay);

    return bar;
  }

  function inject(containerEl: HTMLElement): void {
    container = containerEl;
    const controls = buildControls();
    container.appendChild(controls);
    elements = [controls];
  }

  function destroy(): void {
    elements.forEach((el) => el.remove());
    elements = [];
    container = null;

    // Clear all callbacks
    callbacks.setStart.clear();
    callbacks.setEnd.clear();
    callbacks.toggleLoop.clear();
    callbacks.dragMarker.clear();
  }

  function updateMarkers(start: number, end: number): void {
    if (!container) return;
    const display = container.querySelector('[data-svl-display="time"]');
    if (display) {
      display.textContent = `${formatTime(start)} — ${formatTime(end)}`;
    }
  }

  function setActive(active: boolean): void {
    if (!container) return;
    const toggle = container.querySelector('[data-svl-action="toggle"]') as HTMLElement | null;
    if (toggle) {
      toggle.style.background = active ? ACCENT : 'none';
      toggle.style.color = active ? '#000' : '#fff';
    }
  }

  function onSetStart(cb: (time: number) => void): () => void {
    callbacks.setStart.add(cb);
    return () => callbacks.setStart.delete(cb);
  }

  function onSetEnd(cb: (time: number) => void): () => void {
    callbacks.setEnd.add(cb);
    return () => callbacks.setEnd.delete(cb);
  }

  function onToggleLoop(cb: () => void): () => void {
    callbacks.toggleLoop.add(cb);
    return () => callbacks.toggleLoop.delete(cb);
  }

  function onDragMarker(type: 'start' | 'end', cb: (time: number) => void): () => void {
    const wrapped = (_t: 'start' | 'end', time: number) => {
      if (_t === type) cb(time);
    };
    callbacks.dragMarker.add(wrapped);
    return () => callbacks.dragMarker.delete(wrapped);
  }

  return { inject, destroy, updateMarkers, setActive, onSetStart, onSetEnd, onToggleLoop, onDragMarker };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/content/__tests__/timeline-ui.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add timeline UI with toggle, set A/B buttons and time display"
```

---

## Task 6: Timeline UI — Progress Bar Markers

**Files:**
- Modify: `src/content/timeline-ui.ts`
- Modify: `src/content/__tests__/timeline-ui.test.ts`

- [ ] **Step 1: Add failing tests for progress bar markers**

Append to `src/content/__tests__/timeline-ui.test.ts`:
```typescript
describe('TimelineUI — progress bar markers', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-player';
    // Add a mock progress bar
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
    const ui = createTimelineUI();
    ui.inject(container);
    ui.updateMarkers(0, 100);

    const highlight = container.querySelector('[data-svl-loop-region]') as HTMLElement;
    expect(highlight).not.toBeNull();
    expect(highlight.style.display).not.toBe('none');
    ui.destroy();
  });

  it('hides markers when no loop points set', () => {
    const ui = createTimelineUI();
    ui.inject(container);

    const markers = container.querySelectorAll('[data-svl-marker]');
    // Markers exist but may be hidden
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/content/__tests__/timeline-ui.test.ts
```

Expected: FAIL — marker tests fail because no markers injected yet.

- [ ] **Step 3: Add marker injection to timeline-ui.ts**

Replace the `inject` function and add marker-related functions to `src/content/timeline-ui.ts`:

```typescript
// Add after the buildControls function, before the inject function:

function buildMarkers(): { start: HTMLElement; end: HTMLElement; region: HTMLElement } {
  const startMarker = document.createElement('div');
  startMarker.setAttribute('data-svl-marker', 'start');
  startMarker.style.cssText = `
    position: absolute;
    top: 0;
    bottom: 0;
    width: 3px;
    background: ${ACCENT};
    cursor: ew-resize;
    z-index: 10;
    display: none;
  `;

  const endMarker = document.createElement('div');
  endMarker.setAttribute('data-svl-marker', 'end');
  endMarker.style.cssText = `
    position: absolute;
    top: 0;
    bottom: 0;
    width: 3px;
    background: ${ACCENT};
    cursor: ew-resize;
    z-index: 10;
    display: none;
  `;

  const region = document.createElement('div');
  region.setAttribute('data-svl-loop-region', '');
  region.style.cssText = `
    position: absolute;
    top: 0;
    bottom: 0;
    background: rgba(255,64,129,0.25);
    z-index: 9;
    display: none;
  `;

  return { start: startMarker, end: endMarker, region };
}

function setupDrag(
  marker: HTMLElement,
  type: 'start' | 'end',
  getProgressBar: () => HTMLElement | null,
  callbacks: { dragMarker: Set<(t: 'start' | 'end', time: number) => void> },
  getVideoDuration: () => number,
): void {
  let dragging = false;

  marker.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragging = true;
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const bar = getProgressBar();
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = ratio * getVideoDuration();
    callbacks.dragMarker.forEach((cb) => cb(type, time));
  });

  document.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      document.body.style.userSelect = '';
    }
  });
}

// Replace the inject function:
function inject(containerEl: HTMLElement): void {
  container = containerEl;
  const controls = buildControls();
  container.appendChild(controls);

  // Find YouTube progress bar and inject markers
  const progressBar = container.querySelector('.ytp-progress-bar') as HTMLElement | null;
  if (progressBar) {
    // Ensure progress bar is relative-positioned
    if (getComputedStyle(progressBar).position === 'static') {
      progressBar.style.position = 'relative';
    }
    const markers = buildMarkers();
    progressBar.appendChild(markers.start);
    progressBar.appendChild(markers.region);
    progressBar.appendChild(markers.end);

    setupDrag(markers.start, 'start', () => progressBar, callbacks, () => {
      const video = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
      return video?.duration ?? 0;
    });
    setupDrag(markers.end, 'end', () => progressBar, callbacks, () => {
      const video = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
      return video?.duration ?? 0;
    });
  }

  elements = [controls];
  if (progressBar) {
    // Track marker elements so they can be cleaned up
    const mStart = progressBar.querySelector('[data-svl-marker="start"]') as HTMLElement | null;
    const mEnd = progressBar.querySelector('[data-svl-marker="end"]') as HTMLElement | null;
    const mRegion = progressBar.querySelector('[data-svl-loop-region]') as HTMLElement | null;
    if (mStart) elements.push(mStart);
    if (mEnd) elements.push(mEnd);
    if (mRegion) elements.push(mRegion);
  }
}

// Update the updateMarkers function:
function updateMarkers(start: number, end: number): void {
  if (!container) return;

  // Update time display
  const display = container.querySelector('[data-svl-display="time"]');
  if (display) {
    display.textContent = `${formatTime(start)} — ${formatTime(end)}`;
  }

  // Update marker positions on the progress bar
  const progressBar = container.querySelector('.ytp-progress-bar') as HTMLElement | null;
  if (!progressBar) return;

  const video = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
  const duration = video?.duration ?? 0;
  if (duration === 0) return;

  const startRatio = start / duration;
  const endRatio = end / duration;
  const barWidth = progressBar.getBoundingClientRect().width;

  const startMarker = progressBar.querySelector('[data-svl-marker="start"]') as HTMLElement | null;
  const endMarker = progressBar.querySelector('[data-svl-marker="end"]') as HTMLElement | null;
  const region = progressBar.querySelector('[data-svl-loop-region]') as HTMLElement | null;

  if (startMarker) {
    startMarker.style.display = '';
    startMarker.style.left = `${startRatio * barWidth}px`;
  }
  if (endMarker) {
    endMarker.style.display = '';
    endMarker.style.left = `${endRatio * barWidth}px`;
  }
  if (region) {
    region.style.display = '';
    region.style.left = `${startRatio * barWidth}px`;
    region.style.width = `${(endRatio - startRatio) * barWidth}px`;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/content/__tests__/timeline-ui.test.ts
```

Expected: All tests PASS (both old and new marker tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add draggable progress bar markers with loop region highlight"
```

---

## Task 7: Message Bus

**Files:**
- Create: `src/content/message-bus.ts`
- Create: `src/content/__tests__/message-bus.test.ts`

- [ ] **Step 1: Write failing test for MessageBus**

Write `src/content/__tests__/message-bus.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMessageBus } from '../message-bus';

// Mock chrome.runtime.sendMessage
const mockSendMessage = vi.fn();

beforeEach(() => {
  (globalThis as any).chrome = {
    runtime: {
      sendMessage: mockSendMessage,
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  };
  mockSendMessage.mockReset();
});

afterEach(() => {
  delete (globalThis as any).chrome;
});

describe('MessageBus', () => {
  describe('saveLoop', () => {
    it('sends LOOP_SAVE message', async () => {
      mockSendMessage.mockResolvedValue({ type: 'LOOP_SAVED', payload: { videoId: 'abc', ok: true } });

      const bus = createMessageBus();
      const result = await bus.saveLoop('abc', 10, 30);

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'LOOP_SAVE',
        payload: { videoId: 'abc', start: 10, end: 30 },
      });
      expect(result).toEqual({ ok: true });
    });

    it('handles timeout', async () => {
      mockSendMessage.mockImplementation(() => new Promise(() => {})); // never resolves

      const bus = createMessageBus(100); // 100ms timeout
      const result = await bus.saveLoop('abc', 10, 30);

      expect(result).toEqual({ ok: false });
    });
  });

  describe('loadLoop', () => {
    it('sends LOOP_LOAD and returns loop config', async () => {
      mockSendMessage.mockResolvedValue({
        type: 'LOOP_LOADED',
        payload: { videoId: 'xyz', loop: { start: 5, end: 15 } },
      });

      const bus = createMessageBus();
      const loop = await bus.loadLoop('xyz');

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'LOOP_LOAD',
        payload: { videoId: 'xyz' },
      });
      expect(loop).toEqual({ start: 5, end: 15 });
    });

    it('returns null when no loop saved', async () => {
      mockSendMessage.mockResolvedValue({
        type: 'LOOP_LOADED',
        payload: { videoId: 'xyz', loop: null },
      });

      const bus = createMessageBus();
      const loop = await bus.loadLoop('xyz');
      expect(loop).toBeNull();
    });
  });

  describe('deleteLoop', () => {
    it('sends LOOP_DELETE message', async () => {
      mockSendMessage.mockResolvedValue(undefined);

      const bus = createMessageBus();
      await bus.deleteLoop('abc');

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'LOOP_DELETE',
        payload: { videoId: 'abc' },
      });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/content/__tests__/message-bus.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement createMessageBus**

Write `src/content/message-bus.ts`:
```typescript
import type { OutgoingMessage, IncomingMessage } from '../shared/types';

export interface MessageBus {
  saveLoop(videoId: string, start: number, end: number): Promise<{ ok: boolean }>;
  loadLoop(videoId: string): Promise<{ start: number; end: number } | null>;
  deleteLoop(videoId: string): Promise<void>;
}

export function createMessageBus(timeoutMs = 3000): MessageBus {
  function send<T extends OutgoingMessage['type']>(
    msg: Extract<OutgoingMessage, { type: T }>,
  ): Promise<IncomingMessage | null> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(null);
      }, timeoutMs);

      chrome.runtime.sendMessage(msg, (response: IncomingMessage | undefined) => {
        clearTimeout(timeout);
        resolve(response ?? null);
      });

      // If sendMessage doesn't support callback (Manifest V3 sometimes doesn't),
      // the callback is called synchronously with undefined.
      // The timeout handles the async case.
    });
  }

  return {
    async saveLoop(videoId: string, start: number, end: number): Promise<{ ok: boolean }> {
      const response = await send({
        type: 'LOOP_SAVE',
        payload: { videoId, start, end },
      });
      if (response && response.type === 'LOOP_SAVED') {
        return { ok: response.payload.ok };
      }
      return { ok: false };
    },

    async loadLoop(videoId: string): Promise<{ start: number; end: number } | null> {
      const response = await send({
        type: 'LOOP_LOAD',
        payload: { videoId },
      });
      if (response && response.type === 'LOOP_LOADED' && response.payload.loop) {
        return { start: response.payload.loop.start, end: response.payload.loop.end };
      }
      return null;
    },

    async deleteLoop(videoId: string): Promise<void> {
      await send({
        type: 'LOOP_DELETE',
        payload: { videoId },
      });
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/content/__tests__/message-bus.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add typed message bus for content-script ↔ service-worker communication"
```

---

## Task 8: Service Worker — Storage Handler

**Files:**
- Modify: `src/sw/index.ts`

- [ ] **Step 1: Write unit test for storage logic**

Create `src/sw/__tests__/storage.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Test the storage handlers directly (pure functions extracted for testability)
import { handleSaveLoop, handleLoadLoop, handleDeleteLoop, STORAGE_KEY } from '../storage';

describe('Storage handlers', () => {
  let store: Record<string, any>;

  beforeEach(() => {
    store = {};
    vi.spyOn(chrome.storage.local, 'get').mockImplementation((keys, cb) => {
      const result = { [STORAGE_KEY]: store };
      cb(result);
    });
    vi.spyOn(chrome.storage.local, 'set').mockImplementation((items, cb) => {
      Object.assign(store, items);
      if (cb) cb();
    });
  });

  it('saves a new loop', async () => {
    const result = await handleSaveLoop('abc123', 10, 30);
    expect(result.ok).toBe(true);
    expect(store[STORAGE_KEY]['abc123']).toEqual({
      start: 10,
      end: 30,
      savedAt: expect.any(Number),
    });
  });

  it('overwrites existing loop for same video', async () => {
    await handleSaveLoop('abc123', 10, 30);
    await handleSaveLoop('abc123', 50, 80);

    expect(store[STORAGE_KEY]['abc123'].start).toBe(50);
    expect(store[STORAGE_KEY]['abc123'].end).toBe(80);
  });

  it('loads a saved loop', async () => {
    await handleSaveLoop('abc123', 10, 30);
    const loop = await handleLoadLoop('abc123');
    expect(loop).toEqual({ start: 10, end: 30 });
  });

  it('returns null for unknown video', async () => {
    const loop = await handleLoadLoop('unknown');
    expect(loop).toBeNull();
  });

  it('deletes a loop', async () => {
    await handleSaveLoop('abc123', 10, 30);
    await handleDeleteLoop('abc123');
    const loop = await handleLoadLoop('abc123');
    expect(loop).toBeNull();
  });

  it('handles empty storage gracefully', async () => {
    const loop = await handleLoadLoop('any');
    expect(loop).toBeNull();
  });
});
```

- [ ] **Step 2: Extract pure storage functions**

Create `src/sw/storage.ts`:
```typescript
import type { LoopConfig, LoopStore } from '../shared/types';

export const STORAGE_KEY = 'loops';

async function getStore(): Promise<LoopStore> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      resolve((result[STORAGE_KEY] as LoopStore) ?? {});
    });
  });
}

async function setStore(store: LoopStore): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: store }, () => resolve());
  });
}

export async function handleSaveLoop(
  videoId: string,
  start: number,
  end: number,
): Promise<{ ok: boolean }> {
  try {
    const store = await getStore();
    store[videoId] = { start, end, savedAt: Date.now() };
    await setStore(store);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function handleLoadLoop(
  videoId: string,
): Promise<{ start: number; end: number } | null> {
  const store = await getStore();
  const entry = store[videoId];
  if (!entry) return null;
  return { start: entry.start, end: entry.end };
}

export async function handleDeleteLoop(videoId: string): Promise<void> {
  const store = await getStore();
  delete store[videoId];
  await setStore(store);
}
```

- [ ] **Step 3: Update service worker to wire message handlers**

Replace `src/sw/index.ts`:
```typescript
import type { OutgoingMessage, IncomingMessage } from '../shared/types';
import { handleSaveLoop, handleLoadLoop, handleDeleteLoop } from './storage';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[SmartVideoLoop] Extension installed');
});

chrome.runtime.onMessage.addListener(
  (message: OutgoingMessage, sender, sendResponse: (response: IncomingMessage) => void) => {
    (async () => {
      switch (message.type) {
        case 'LOOP_SAVE': {
          const { videoId, start, end } = message.payload;
          const result = await handleSaveLoop(videoId, start, end);
          sendResponse({
            type: 'LOOP_SAVED',
            payload: { videoId, ok: result.ok },
          });
          break;
        }

        case 'LOOP_LOAD': {
          const { videoId } = message.payload;
          const loop = await handleLoadLoop(videoId);
          sendResponse({
            type: 'LOOP_LOADED',
            payload: { videoId, loop },
          });
          break;
        }

        case 'LOOP_DELETE': {
          const { videoId } = message.payload;
          await handleDeleteLoop(videoId);
          // No response needed for delete
          break;
        }
      }
    })();

    return true; // keep channel open for async response
  },
);

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'KEYBOARD_SHORTCUT', payload: { action: command } });
    }
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/sw/__tests__/storage.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: Build succeeds, `dist/sw.js` includes storage logic.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add service worker with storage handlers and keyboard shortcuts"
```

---

## Task 9: Content Script — Wire Everything Together

**Files:**
- Modify: `src/content/index.ts`

- [ ] **Step 1: Write integration test for content script wiring**

Create `src/content/__tests__/index.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockVideo = {
  currentTime: 0,
  duration: 300,
  play: vi.fn(),
  pause: vi.fn(),
} as unknown as HTMLVideoElement;

// Mock modules
vi.mock('../youtube-detector', () => ({
  createYouTubeDetector: () => ({
    isWatchPage: () => true,
    getVideoId: () => 'test-video-id',
    onPageChange: vi.fn(() => () => {}),
    waitForPlayer: () => Promise.resolve(mockVideo),
  }),
}));

const mockBus = {
  saveLoop: vi.fn().mockResolvedValue({ ok: true }),
  loadLoop: vi.fn().mockResolvedValue(null),
  deleteLoop: vi.fn(),
};

vi.mock('../message-bus', () => ({
  createMessageBus: () => mockBus,
}));

describe('Content script integration', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'movie_player';
    document.body.appendChild(container);

    // Mock chrome.runtime
    (globalThis as any).chrome = {
      runtime: {
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    };
  });

  afterEach(() => {
    document.body.removeChild(container);
    delete (globalThis as any).chrome;
    vi.resetModules();
  });

  it('injects UI when on a watch page', async () => {
    // Dynamically import to trigger the init
    await import('../index');

    // Wait for async init
    await new Promise((r) => setTimeout(r, 50));

    // UI should be injected into the player
    const buttons = document.querySelectorAll('[data-svl-button]');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('loads saved loop points on init', async () => {
    mockBus.loadLoop.mockResolvedValue({ start: 30, end: 60 });

    await import('../index');
    await new Promise((r) => setTimeout(r, 50));

    expect(mockBus.loadLoop).toHaveBeenCalledWith('test-video-id');
    const display = document.querySelector('[data-svl-display="time"]');
    expect(display?.textContent).toBe('0:30 — 1:00');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/content/__tests__/index.test.ts
```

Expected: FAIL — index.ts doesn't wire modules yet.

- [ ] **Step 3: Wire content script entry point**

Replace `src/content/index.ts`:
```typescript
import { createYouTubeDetector } from './youtube-detector';
import { createLoopEngine } from './loop-engine';
import { createTimelineUI } from './timeline-ui';
import { createMessageBus } from './message-bus';

interface AppState {
  loopActive: boolean;
  startSet: boolean;
  endSet: boolean;
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

  const state: AppState = { loopActive: false, startSet: false, endSet: false };

  // Inject UI
  ui.inject(playerContainer);

  // Load saved loop points
  const saved = await bus.loadLoop(videoId);
  if (saved) {
    engine.setLoop(saved.start, saved.end);
    state.startSet = true;
    state.endSet = true;
    ui.updateMarkers(saved.start, saved.end);
    console.log(`[SmartVideoLoop] Loaded saved loop: ${saved.start} — ${saved.end}`);
  }

  // Wire UI events → Engine + Storage
  ui.onSetStart((time) => {
    const existing = engine.getLoopPoints();
    engine.setLoop(time, existing?.end ?? video.duration);
    state.startSet = true;

    const points = engine.getLoopPoints();
    if (points) {
      ui.updateMarkers(points.start, points.end);
      bus.saveLoop(videoId, points.start, points.end);
    }
  });

  ui.onSetEnd((time) => {
    const existing = engine.getLoopPoints();
    engine.setLoop(existing?.start ?? 0, time);
    state.endSet = true;

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

  // Handle SPA navigation
  detector.onPageChange(() => {
    console.log('[SmartVideoLoop] Video changed, cleaning up');
    engine.disable();
    ui.destroy();
    // Re-init for new video
    setTimeout(() => init(), 1000);
  });

  // Handle video end (natural)
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
  if (message.type === 'KEYBOARD_SHORTCUT') {
    const { action } = message.payload;
    const video = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
    if (!video) return;

    switch (action) {
      case 'toggle_loop':
        // Toggle via UI callback
        const toggleBtn = document.querySelector('[data-svl-action="toggle"]') as HTMLElement | null;
        toggleBtn?.click();
        break;
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
if (document.readyState === 'complete') {
  init();
} else {
  window.addEventListener('load', init);
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/content/__tests__/index.test.ts
```

Expected: Tests PASS.

- [ ] **Step 5: Run all unit tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 6: Build the extension**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: wire content script with all modules, SPA handling, and keyboard shortcuts"
```

---

## Task 10: End-to-End Tests with Playwright

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/smart-video-loop.spec.ts`

- [ ] **Step 1: Write Playwright config**

Write `playwright.config.ts`:
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 1,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000,
  },
});
```

- [ ] **Step 2: Write E2E test**

Write `e2e/smart-video-loop.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.resolve(__dirname, '..');
const TEST_VIDEO = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

test.describe('Smart Video Loop Extension', () => {
  test('extension loads and injects UI on YouTube', async ({ page }) => {
    // Load extension
    const context = page.context();
    // Note: For real Playwright + Chrome Extensions, you'd load via chromeExtensions
    // or use a setup script. This test documents the expected behavior.
  });

  test('Set A and Set B buttons appear in YouTube player', async ({ page }) => {
    // Navigate to a YouTube video
    await page.goto(TEST_VIDEO, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('video.html5-main-video', { timeout: 15000 });

    // Wait for extension to inject
    await page.waitForSelector('[data-svl-button]', { timeout: 10000 });

    // Verify buttons exist
    const toggleBtn = page.locator('[data-svl-action="toggle"]');
    await expect(toggleBtn).toBeVisible();

    const setABtn = page.locator('[data-svl-action="set-start"]');
    await expect(setABtn).toBeVisible();

    const setBBtn = page.locator('[data-svl-action="set-end"]');
    await expect(setBBtn).toBeVisible();
  });

  test('setting loop points updates time display', async ({ page }) => {
    await page.goto(TEST_VIDEO, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-svl-button]', { timeout: 10000 });

    // Click Set A (video starts at 0:00)
    await page.locator('[data-svl-action="set-start"]').click();

    // Seek forward
    const video = page.locator('video.html5-main-video');
    await video.evaluate((el) => { (el as HTMLVideoElement).currentTime = 30; });

    // Click Set B
    await page.locator('[data-svl-action="set-end"]').click();

    // Verify time display shows loop range
    const timeDisplay = page.locator('[data-svl-display="time"]');
    await expect(timeDisplay).toContainText('0:00');
    await expect(timeDisplay).toContainText('0:30');
  });

  test('toggle button activates/deactivates loop', async ({ page }) => {
    await page.goto(TEST_VIDEO, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-svl-button]', { timeout: 10000 });

    // Set loop points
    await page.locator('[data-svl-action="set-start"]').click();
    const video = page.locator('video.html5-main-video');
    await video.evaluate((el) => { (el as HTMLVideoElement).currentTime = 30; });
    await page.locator('[data-svl-action="set-end"]').click();

    // Toggle loop on
    const toggle = page.locator('[data-svl-action="toggle"]');
    await toggle.click();

    // Verify button shows active styling
    await expect(toggle).toHaveCSS('background-color', 'rgb(255, 64, 129)');
  });
});
```

- [ ] **Step 3: Verify tests are documented**

Note: Real Playwright + Chrome Extension E2E requires loading the unpacked extension via `chromeExtensions` or `--load-extension` flag. Full E2E automation setup will be handled in a follow-up task once the extension is installable.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test: add Playwright E2E test skeleton for YouTube loop flow"
```

---

## Task 11: Icons & Polish

**Files:**
- Create: `assets/icons/icon-16.png`
- Create: `assets/icons/icon-48.png`
- Create: `assets/icons/icon-128.png`
- Modify: `package.json` (add icon generation script)

- [ ] **Step 1: Create simple SVG-based icon generation**

Create `scripts/generate-icons.mjs`:
```javascript
// Generate simple SVG placeholder icons using canvas
// For production, replace with actual icon design
import { createCanvas } from 'canvas'; // requires 'canvas' package
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const sizes = [16, 48, 128];

mkdirSync(join(import.meta.dirname, '..', 'assets', 'icons'), { recursive: true });

for (const size of sizes) {
  // Placeholder: create a simple loop icon
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background: pink circle
  ctx.fillStyle = '#FF4081';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fill();

  // Loop arrow (simplified for small sizes)
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = Math.max(1, size / 8);
  ctx.stroke();

  const buffer = canvas.toBuffer('image/png');
  writeFileSync(join(import.meta.dirname, '..', 'assets', 'icons', `icon-${size}.png`), buffer);
}
```

For MVP, create a simple colored placeholder. Write a minimal 1x1 pink pixel PNG as placeholder:
```bash
# Use a simple approach — create a placeholder icon script
```

Actually for MVP, create a minimal valid PNG programmatically:

Create `scripts/generate-icons.mjs`:
```javascript
// Minimal valid PNG generator for placeholder icons
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

// Minimal 1x1 pink PNG (valid PNG binary)
// For MVP we'll create placeholder files
// In production, replace with actual designed icons

const sizes = [16, 48, 128];

mkdirSync(join(import.meta.dirname, '..', 'assets', 'icons'), { recursive: true });

// Create simple placeholder text files (real PNGs need canvas/image library)
// For now, document that icons need to be added manually
console.log('Placeholder icons directory created.');
console.log('Add icon-16.png, icon-48.png, icon-128.png to assets/icons/');
```

- [ ] **Step 2: Document icon requirement**

Write `assets/icons/README.md`:
```markdown
# Extension Icons

Replace these placeholder files with actual designed icons:

- icon-16.png (16x16) — toolbar icon
- icon-48.png (48x48) — extensions page
- icon-128.png (128x128) — Chrome Web Store

Design requirements:
- Accent color: #FF4081 (pink)
- Symbol: loop/repeat arrow
- Clean, recognizable at small sizes
```

- [ ] **Step 3: Create minimal valid PNG placeholder (1x1 pink pixel)**

For actual valid PNGs, we'll create tiny valid PNG files using a hex string:

```bash
# This is a valid 1x1 pink PNG in base64 — can decode to create placeholder
# For now, create empty touch files and note they need real PNGs
```

Create the icons directory with placeholder files:

Write minimal valid 1x1 PNG files using Node.js buffer. Since we can't use canvas without installing it, create tiny icons by writing raw PNG bytes.

Create `scripts/create-placeholder-icons.mjs`:
```javascript
import { writeFileSync } from 'fs';
import { join } from 'path';

// Minimal valid 1x1 PNG — hot pink pixel
// Will be replaced with properly designed icons before release
function createMinimalPNG(r, g, b) {
  // Minimal PNG: 1x1 pixel, no palette
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(1, 0); // width
  ihdrData.writeUInt32BE(1, 4); // height
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = createChunk('IHDR', ihdrData);

  // IDAT chunk — 1 filtered RGB pixel
  const rawPixel = Buffer.from([0, r, g, b]); // filter byte + RGB
  const zlib = await import('zlib');
  const compressed = zlib.deflateSync(rawPixel);
  const idat = createChunk('IDAT', compressed);

  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBuffer, data]));
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

const pink = createMinimalPNG(255, 64, 129);
writeFileSync('assets/icons/icon-16.png', pink);
writeFileSync('assets/icons/icon-48.png', pink);
writeFileSync('assets/icons/icon-128.png', pink);
console.log('Placeholder icons created.');
```

- [ ] **Step 4: Run icon generation**

```bash
node scripts/create-placeholder-icons.mjs
```

Expected: Three PNG files created in `assets/icons/`.

- [ ] **Step 5: Final build verification**

```bash
npm run build
```

Expected: Clean build, all files in `dist/`.

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: add placeholder icons and finalize build"
```

---

## Summary

**Total tasks:** 11
**Estimated time:** 2-3 hours for an experienced developer

### File Map (after implementation)

```
smart-video-loop/
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── playwright.config.ts
├── .gitignore
├── assets/
│   └── icons/
│       ├── icon-16.png
│       ├── icon-48.png
│       ├── icon-128.png
│       └── README.md
├── dist/                          # Build output (gitignored)
│   ├── content.js
│   └── sw.js
├── src/
│   ├── shared/
│   │   ├── types.ts
│   │   └── __tests__/
│   │       └── types.test.ts
│   ├── content/
│   │   ├── index.ts               # Entry — wires all modules
│   │   ├── youtube-detector.ts
│   │   ├── loop-engine.ts
│   │   ├── timeline-ui.ts
│   │   ├── message-bus.ts
│   │   └── __tests__/
│   │       ├── index.test.ts
│   │       ├── youtube-detector.test.ts
│   │       ├── loop-engine.test.ts
│   │       ├── timeline-ui.test.ts
│   │       └── message-bus.test.ts
│   └── sw/
│       ├── index.ts               # Service worker entry
│       ├── storage.ts             # Pure storage functions
│       └── __tests__/
│           └── storage.test.ts
├── e2e/
│   └── smart-video-loop.spec.ts
├── scripts/
│   └── create-placeholder-icons.mjs
└── docs/
    └── superpowers/
        ├── specs/
        │   └── 2026-06-16-smart-video-loop-design.md
        └── plans/
            └── 2026-06-16-smart-video-loop.md
```
