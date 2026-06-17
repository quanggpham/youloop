import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMessageBus } from '../message-bus';

const mockSendMessage = vi.fn((_msg: unknown, callback?: (r: unknown) => void) => {
  const saved = callbacks.get('default');
  if (saved && callback) {
    Promise.resolve(saved).then(callback);
  }
});

let callbacks = new Map<string, unknown>();

function setResponse(response: unknown) {
  callbacks.set('default', response);
}

beforeEach(() => {
  callbacks = new Map<string, unknown>();
  mockSendMessage.mockClear();
  (globalThis as any).chrome = {
    runtime: {
      sendMessage: mockSendMessage,
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  };
});

afterEach(() => {
  delete (globalThis as any).chrome;
});

describe('MessageBus', () => {
  describe('saveLoop', () => {
    it('sends LOOP_SAVE message', async () => {
      setResponse({ type: 'LOOP_SAVED', payload: { videoId: 'abc', ok: true } });

      const bus = createMessageBus(1000);
      const result = await bus.saveLoop('abc', 10, 30);

      expect(mockSendMessage).toHaveBeenCalledWith(
        { type: 'LOOP_SAVE', payload: { videoId: 'abc', start: 10, end: 30 } },
        expect.any(Function),
      );
      expect(result).toEqual({ ok: true });
    });

    it('handles timeout', async () => {
      const bus = createMessageBus(0); // immediate timeout
      const result = await bus.saveLoop('abc', 10, 30);
      expect(result).toEqual({ ok: false });
    });
  });

  describe('loadLoop', () => {
    it('sends LOOP_LOAD and returns loop config', async () => {
      setResponse({
        type: 'LOOP_LOADED',
        payload: { videoId: 'xyz', loop: { start: 5, end: 15 } },
      });

      const bus = createMessageBus(1000);
      const loop = await bus.loadLoop('xyz');

      expect(mockSendMessage).toHaveBeenCalledWith(
        { type: 'LOOP_LOAD', payload: { videoId: 'xyz' } },
        expect.any(Function),
      );
      expect(loop).toEqual({ start: 5, end: 15 });
    });

    it('returns null when no loop saved', async () => {
      setResponse({
        type: 'LOOP_LOADED',
        payload: { videoId: 'xyz', loop: null },
      });

      const bus = createMessageBus(1000);
      const loop = await bus.loadLoop('xyz');
      expect(loop).toBeNull();
    });
  });

  describe('deleteLoop', () => {
    it('sends LOOP_DELETE message', async () => {
      setResponse(undefined);

      const bus = createMessageBus(1000);
      await bus.deleteLoop('abc');

      expect(mockSendMessage).toHaveBeenCalledWith(
        { type: 'LOOP_DELETE', payload: { videoId: 'abc' } },
        expect.any(Function),
      );
    });
  });
});
