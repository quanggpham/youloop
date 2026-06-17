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
