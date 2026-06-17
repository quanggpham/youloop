import { describe, it, expect, afterEach } from 'vitest';
import { createYouTubeDetector } from '../youtube-detector';

/**
 * Helper to stub window.location.href in jsdom.
 * jsdom doesn't allow pushState across origins and doesn't support
 * direct assignment to window.location.href, so we stub the getter.
 */
function setLocation(url: string): void {
  Object.defineProperty(window, 'location', {
    value: {
      ...window.location,
      href: url,
    },
    writable: true,
    configurable: true,
  });
}

/**
 * Helper to quickly create a detector with the current stubbed URL.
 */
function makeDetector() {
  // Re-create so internal state (like getVideoId's new URL parsing)
  // uses the currently stubbed location.
  return createYouTubeDetector();
}

// Restore the original location after each test
const originalLocation = window.location;

afterEach(() => {
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
});

describe('YouTubeDetector', () => {
  describe('isWatchPage', () => {
    it('returns true for watch URLs', () => {
      setLocation('https://www.youtube.com/watch?v=abc123');
      const detector = makeDetector();
      expect(detector.isWatchPage()).toBe(true);
    });

    it('returns false for shorts URLs', () => {
      setLocation('https://www.youtube.com/shorts/abc123');
      const detector = makeDetector();
      expect(detector.isWatchPage()).toBe(false);
    });

    it('returns false for other YouTube pages', () => {
      setLocation('https://www.youtube.com/feed/trending');
      const detector = makeDetector();
      expect(detector.isWatchPage()).toBe(false);
    });

    it('returns true for embed URLs', () => {
      setLocation('https://www.youtube.com/embed/abc123');
      const detector = makeDetector();
      expect(detector.isWatchPage()).toBe(true);
    });
  });

  describe('getVideoId', () => {
    it('extracts video ID from watch URL', () => {
      setLocation('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      const detector = makeDetector();
      expect(detector.getVideoId()).toBe('dQw4w9WgXcQ');
    });

    it('extracts video ID from embed URL', () => {
      setLocation('https://www.youtube.com/embed/abc123');
      const detector = makeDetector();
      expect(detector.getVideoId()).toBe('abc123');
    });

    it('extracts video ID with extra query params', () => {
      setLocation('https://www.youtube.com/watch?v=abc123&t=30&list=PLxyz');
      const detector = makeDetector();
      expect(detector.getVideoId()).toBe('abc123');
    });

    it('returns null for non-video pages', () => {
      setLocation('https://www.youtube.com/');
      const detector = makeDetector();
      expect(detector.getVideoId()).toBeNull();
    });
  });

  describe('onPageChange', () => {
    it('calls callback on URL change', async () => {
      setLocation('https://www.youtube.com/watch?v=old123');
      const detector = makeDetector();
      const changes: string[] = [];
      detector.onPageChange((id) => changes.push(id));

      // Simulate YouTube SPA navigation
      setLocation('https://www.youtube.com/watch?v=new456');
      window.dispatchEvent(new CustomEvent('yt-navigate-finish'));

      // Wait for microtask
      await new Promise((r) => setTimeout(r, 10));
      expect(changes).toEqual(['new456']);
    });

    it('returns cleanup function', () => {
      setLocation('https://www.youtube.com/watch?v=abc123');
      const detector = makeDetector();
      const cleanup = detector.onPageChange(() => {});
      expect(typeof cleanup).toBe('function');
      cleanup(); // should not throw
    });
  });
});
