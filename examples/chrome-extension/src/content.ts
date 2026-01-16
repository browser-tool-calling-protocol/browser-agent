/**
 * Content Script - registers DOM agent and message listener
 */
import { createContentAgent } from 'btcp-browser-agent/extension';

const agent = createContentAgent();

// Listen for commands from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'btcp:command') return false;

  agent.execute(message.command)
    .then(response => {
      sendResponse({ type: 'btcp:response', response });
    })
    .catch(error => {
      sendResponse({
        type: 'btcp:response',
        response: {
          id: message.command.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    });

  return true; // Keep channel open for async response
});
