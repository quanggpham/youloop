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
