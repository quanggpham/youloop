import type { OutgoingMessage, IncomingMessage } from '../shared/types';
import { handleSaveLoop, handleLoadLoop, handleDeleteLoop } from './storage';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[SmartVideoLoop] Extension installed');
});

chrome.runtime.onMessage.addListener(
  (message: OutgoingMessage, _sender: chrome.runtime.MessageSender, sendResponse: (response: IncomingMessage) => void) => {
    (async () => {
      switch (message.type) {
        case 'LOOP_SAVE': {
          const { videoId, start, end } = message.payload;
          const result = await handleSaveLoop(videoId, start, end);
          sendResponse({
            type: 'LOOP_SAVED',
            payload: { videoId, ok: result.ok },
          });
          break;
        }

        case 'LOOP_LOAD': {
          const { videoId } = message.payload;
          const loop = await handleLoadLoop(videoId);
          sendResponse({
            type: 'LOOP_LOADED',
            payload: { videoId, loop },
          });
          break;
        }

        case 'LOOP_DELETE': {
          const { videoId } = message.payload;
          await handleDeleteLoop(videoId);
          break;
        }
      }
    })();

    return true; // keep channel open for async response
  },
);

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'KEYBOARD_SHORTCUT', payload: { action: command } });
    }
  });
});
