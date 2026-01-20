/**
 * Popup Script - Remote Control Extension
 *
 * Simple UI for connecting/disconnecting from the BTCP server.
 */

// DOM Elements
const serverUrlInput = document.getElementById('serverUrl') as HTMLInputElement;
const btnConnect = document.getElementById('btnConnect') as HTMLButtonElement;
const btnDisconnect = document.getElementById('btnDisconnect') as HTMLButtonElement;
const statusDot = document.getElementById('statusDot') as HTMLSpanElement;
const statusText = document.getElementById('statusText') as HTMLSpanElement;
const logOutput = document.getElementById('logOutput') as HTMLDivElement;

// State
let isConnected = false;

// Logging
function log(message: string, type: 'info' | 'success' | 'error' | 'tool' = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const colors: Record<string, string> = {
    info: '#666',
    success: '#22c55e',
    error: '#ef4444',
    tool: '#8b5cf6',
  };

  const entry = document.createElement('div');
  entry.style.color = colors[type];
  entry.style.marginBottom = '4px';
  entry.textContent = `[${timestamp}] ${message}`;
  logOutput.appendChild(entry);
  logOutput.scrollTop = logOutput.scrollHeight;
}

// Update UI based on connection state
function updateUI(connected: boolean) {
  isConnected = connected;

  if (connected) {
    statusDot.style.background = '#22c55e';
    statusText.textContent = 'Connected';
    btnConnect.style.display = 'none';
    btnDisconnect.style.display = 'block';
    serverUrlInput.disabled = true;
  } else {
    statusDot.style.background = '#ef4444';
    statusText.textContent = 'Disconnected';
    btnConnect.style.display = 'block';
    btnDisconnect.style.display = 'none';
    serverUrlInput.disabled = false;
  }
}

// Connect to server
async function connect() {
  const serverUrl = serverUrlInput.value.trim();
  if (!serverUrl) {
    log('Please enter a server URL', 'error');
    return;
  }

  btnConnect.disabled = true;
  btnConnect.textContent = 'Connecting...';
  log(`Connecting to ${serverUrl}...`, 'info');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'remote:connect',
      serverUrl,
    });

    if (response.success) {
      log('Connected successfully!', 'success');
      updateUI(true);
      // Save URL for next time
      chrome.storage.local.set({ lastServerUrl: serverUrl });
    } else {
      log(`Connection failed: ${response.error}`, 'error');
    }
  } catch (error) {
    log(`Connection failed: ${error}`, 'error');
  } finally {
    btnConnect.disabled = false;
    btnConnect.textContent = 'Connect';
  }
}

// Disconnect from server
async function disconnect() {
  log('Disconnecting...', 'info');

  try {
    await chrome.runtime.sendMessage({ type: 'remote:disconnect' });
    log('Disconnected', 'info');
    updateUI(false);
  } catch (error) {
    log(`Disconnect error: ${error}`, 'error');
  }
}

// Handle events from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'remote:event') return;

  switch (message.event) {
    case 'connected':
      updateUI(true);
      break;
    case 'disconnected':
      updateUI(false);
      log('Connection lost', 'error');
      break;
    case 'error':
      log(`Error: ${message.data}`, 'error');
      break;
    case 'toolCall':
      log(`Tool: ${message.data.name}`, 'tool');
      break;
  }
});

// Initialize
async function init() {
  // Check current connection status
  try {
    const status = await chrome.runtime.sendMessage({ type: 'remote:status' });
    updateUI(status.connected);
  } catch {
    updateUI(false);
  }

  // Load last server URL
  const stored = await chrome.storage.local.get('lastServerUrl');
  if (stored.lastServerUrl) {
    serverUrlInput.value = stored.lastServerUrl;
  }

  log('Ready to connect', 'info');
}

// Event listeners
btnConnect.addEventListener('click', connect);
btnDisconnect.addEventListener('click', disconnect);
serverUrlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !isConnected) {
    connect();
  }
});

init();
