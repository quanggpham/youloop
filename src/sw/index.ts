// Service worker entry point — will be wired in later tasks
chrome.runtime.onInstalled.addListener(() => {
  console.log('[SmartVideoLoop] Extension installed');
});
