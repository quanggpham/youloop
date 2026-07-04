import type { OutgoingMessage, IncomingMessage, ExtensionMessage } from '../shared/types';
import { handleSaveLoop, handleLoadLoop, handleDeleteLoop, handleGetEnabled, handleSetEnabled } from './storage';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[SmartVideoLoop] Extension installed');
});

chrome.runtime.onMessage.addListener(
  (message: OutgoingMessage | ExtensionMessage, _sender: chrome.runtime.MessageSender, sendResponse: (response: IncomingMessage | { type: string; payload: Record<string, unknown> }) => void) => {
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

        case 'GET_ENABLED': {
          const enabled = await handleGetEnabled();
          sendResponse({
            type: 'ENABLED_STATE',
            payload: { enabled },
          });
          break;
        }

        case 'SET_ENABLED': {
          await handleSetEnabled(message.payload.enabled);
          break;
        }
      }
    })();

    return true; // keep channel open for async response
  },
);

// Keyboard shortcuts have been removed to avoid conflicts with browser/system shortcuts.
// Users interact via mouse: click buttons in the player or drag markers on the progress bar.
