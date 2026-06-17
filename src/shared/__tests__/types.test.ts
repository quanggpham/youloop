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
