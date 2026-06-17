import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleSaveLoop, handleLoadLoop, handleDeleteLoop, STORAGE_KEY } from '../storage';

describe('Storage handlers', () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};

    (globalThis as any).chrome = {
      storage: {
        local: {
          get: vi.fn((_keys: string[], cb: (r: Record<string, unknown>) => void) => {
            cb({ [STORAGE_KEY]: store });
          }),
          set: vi.fn((_items: Record<string, unknown>, cb?: () => void) => {
            Object.assign(store, _items);
            if (cb) cb();
          }),
        },
      },
    };
  });

  it('saves a new loop', async () => {
    const result = await handleSaveLoop('abc123', 10, 30);
    expect(result.ok).toBe(true);
    const entry = (store[STORAGE_KEY] as Record<string, unknown>)['abc123'] as Record<string, unknown>;
    expect(entry).toEqual({
      start: 10,
      end: 30,
      savedAt: expect.any(Number),
    });
  });

  it('overwrites existing loop for same video', async () => {
    await handleSaveLoop('abc123', 10, 30);
    await handleSaveLoop('abc123', 50, 80);

    const entry = (store[STORAGE_KEY] as Record<string, unknown>)['abc123'] as Record<string, unknown>;
    expect(entry.start).toBe(50);
    expect(entry.end).toBe(80);
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
