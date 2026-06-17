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

    // Watch page: ?v=VIDEO_ID
    const watchId = url.searchParams.get('v');
    if (watchId) return watchId;

    // Embed page: /embed/VIDEO_ID
    const embedMatch = url.pathname.match(/^\/embed\/([^/]+)/);
    if (embedMatch) return embedMatch[1];

    return null;
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
