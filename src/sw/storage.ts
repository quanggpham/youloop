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

// ── Extension enabled/disabled toggle ─────────────────

const ENABLED_KEY = 'extensionEnabled';

export async function handleGetEnabled(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get(ENABLED_KEY, (result) => {
      const val = result[ENABLED_KEY];
      resolve(val === undefined ? true : Boolean(val));
    });
  });
}

export async function handleSetEnabled(enabled: boolean): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [ENABLED_KEY]: enabled }, () => resolve());
  });
}
