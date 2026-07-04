const STORAGE_KEY = 'extensionEnabled';

const toggleBtn = document.getElementById('toggleBtn') as HTMLInputElement;
const statusText = document.getElementById('statusText') as HTMLSpanElement;

let enabled = true;

function loadState(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const val = result[STORAGE_KEY];
      resolve(val === undefined ? true : Boolean(val));
    });
  });
}

function saveState(val: boolean): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: val }, () => resolve());
  });
}

function notifyContentScript(val: boolean): Promise<void> {
  return chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    const tab = tabs[0];
    if (!tab?.id || !tab.url?.includes('youtube.com')) return;
    chrome.tabs.sendMessage(tab.id, {
      type: 'SET_ENABLED',
      payload: { enabled: val },
    }).catch(() => {}); // content script may not be loaded
  });
}

function render(): void {
  toggleBtn.checked = enabled;
  statusText.textContent = enabled ? 'Active on YouTube' : 'Disabled';
  statusText.className = enabled ? 'status on' : 'status';
}

toggleBtn.addEventListener('change', () => {
  enabled = toggleBtn.checked;
  render();
  saveState(enabled);
  notifyContentScript(enabled);
});

(async () => {
  enabled = await loadState();
  render();
})();
