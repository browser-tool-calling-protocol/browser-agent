/**
 * Background Script - Remote Control Extension
 *
 * Sets up the message listener for the background agent and handles
 * remote control connection state.
 */
import { setupMessageListener, createRemoteAgent, type RemoteAgent } from '@btcp/browser-agent/extension';

// Set up the standard message listener
setupMessageListener();

// Store remote agent instance
let remoteAgent: RemoteAgent | null = null;

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'remote:connect') {
    handleConnect(message.serverUrl)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  }

  if (message.type === 'remote:disconnect') {
    handleDisconnect();
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'remote:status') {
    sendResponse({
      connected: remoteAgent?.isConnected() ?? false,
      state: remoteAgent?.getState() ?? 'disconnected',
    });
    return true;
  }

  return false;
});

async function handleConnect(serverUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (remoteAgent?.isConnected()) {
      remoteAgent.disconnect();
    }

    remoteAgent = createRemoteAgent({
      serverUrl,
      sessionId: `browser-${Date.now()}`,
      autoReconnect: true,
      debug: true,
    });

    // Set up event handlers
    remoteAgent.on('connect', () => {
      console.log('[Remote] Connected to server');
      notifyPopup('connected');
    });

    remoteAgent.on('disconnect', () => {
      console.log('[Remote] Disconnected from server');
      notifyPopup('disconnected');
    });

    remoteAgent.on('error', (error) => {
      console.error('[Remote] Error:', error);
      notifyPopup('error', error.message);
    });

    remoteAgent.on('toolCall', (name, args) => {
      console.log('[Remote] Tool call:', name, args);
      notifyPopup('toolCall', { name, args });
    });

    await remoteAgent.connect();
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

function handleDisconnect(): void {
  if (remoteAgent) {
    remoteAgent.disconnect();
    remoteAgent = null;
  }
}

function notifyPopup(event: string, data?: unknown): void {
  chrome.runtime.sendMessage({
    type: 'remote:event',
    event,
    data,
  }).catch(() => {
    // Popup might not be open, ignore errors
  });
}

console.log('[BTCP Remote Control] Background ready');
