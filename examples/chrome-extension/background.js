/**
 * Background Service Worker
 *
 * Using BrowserAgent from @aspect/extension for clean, class-based API.
 *
 * In production with bundler:
 *   import { BrowserAgent, setupMessageListener } from '@aspect/extension';
 *
 * This standalone example implements the same API inline.
 */

// ============================================================================
// BrowserAgent - High-level browser orchestrator
// In production: import { BrowserAgent } from '@aspect/extension';
// ============================================================================

class BrowserAgent {
  constructor() {
    this.activeTabId = null;
    this.initActiveTab();
  }

  async initActiveTab() {
    const tab = await this.getActiveTab();
    this.activeTabId = tab?.id ?? null;
  }

  // --- Tab Management ---

  async getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  }

  async listTabs() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    return tabs.map(t => ({
      id: t.id,
      url: t.url,
      title: t.title,
      active: t.active,
      index: t.index,
    }));
  }

  async newTab(options = {}) {
    const tab = await chrome.tabs.create({
      url: options.url,
      active: options.active ?? true,
    });
    if (options.url) {
      await this.waitForTabLoad(tab.id);
    }
    if (options.active !== false) {
      this.activeTabId = tab.id;
    }
    return { id: tab.id, url: tab.url, title: tab.title, active: tab.active, index: tab.index };
  }

  async closeTab(tabId) {
    const targetId = tabId ?? this.activeTabId;
    if (!targetId) throw new Error('No tab to close');
    await chrome.tabs.remove(targetId);
    if (targetId === this.activeTabId) {
      const tab = await this.getActiveTab();
      this.activeTabId = tab?.id ?? null;
    }
  }

  async switchTab(tabId) {
    await chrome.tabs.update(tabId, { active: true });
    this.activeTabId = tabId;
  }

  // --- Navigation ---

  async navigate(url, options = {}) {
    const tabId = this.activeTabId ?? (await this.getActiveTab())?.id;
    if (!tabId) throw new Error('No active tab');
    await chrome.tabs.update(tabId, { url });
    if (options.waitUntil) {
      await this.waitForTabLoad(tabId);
    }
  }

  async back() {
    const tabId = this.activeTabId ?? (await this.getActiveTab())?.id;
    if (!tabId) throw new Error('No active tab');
    await chrome.tabs.goBack(tabId);
  }

  async forward() {
    const tabId = this.activeTabId ?? (await this.getActiveTab())?.id;
    if (!tabId) throw new Error('No active tab');
    await chrome.tabs.goForward(tabId);
  }

  async reload(options = {}) {
    const tabId = this.activeTabId ?? (await this.getActiveTab())?.id;
    if (!tabId) throw new Error('No active tab');
    await chrome.tabs.reload(tabId, { bypassCache: options.bypassCache });
    await this.waitForTabLoad(tabId);
  }

  async getUrl() {
    const tab = await this.getActiveTab();
    return tab?.url || '';
  }

  async getTitle() {
    const tab = await this.getActiveTab();
    return tab?.title || '';
  }

  // --- Screenshots ---

  async screenshot(options = {}) {
    const format = options.format || 'png';
    const quality = options.quality;
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format, quality });
    return dataUrl.split(',')[1]; // Return base64 data
  }

  // --- Command Execution ---

  async execute(command) {
    try {
      if (this.isExtensionCommand(command)) {
        return this.executeExtensionCommand(command);
      }
      return this.sendToContentAgent(command);
    } catch (error) {
      return { id: command.id, success: false, error: error.message };
    }
  }

  async sendToContentAgent(command, tabId) {
    const targetTabId = tabId ?? this.activeTabId ?? (await this.getActiveTab())?.id;
    if (!targetTabId) {
      return { id: command.id, success: false, error: 'No active tab for DOM command' };
    }

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(
        targetTabId,
        { type: 'aspect:command', command },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              id: command.id,
              success: false,
              error: chrome.runtime.lastError.message || 'Failed to send to tab',
            });
          } else {
            resolve(response?.response || { id: command.id, success: false, error: 'No response' });
          }
        }
      );
    });
  }

  // --- Private Helpers ---

  isExtensionCommand(command) {
    const extensionActions = [
      'navigate', 'back', 'forward', 'reload',
      'getUrl', 'getTitle', 'screenshot',
      'tabNew', 'tabClose', 'tabSwitch', 'tabList',
    ];
    return extensionActions.includes(command.action);
  }

  async executeExtensionCommand(command) {
    switch (command.action) {
      case 'navigate':
        await this.navigate(command.url, { waitUntil: command.waitUntil });
        return { id: command.id, success: true, data: { url: command.url } };

      case 'back':
        await this.back();
        return { id: command.id, success: true, data: { navigated: 'back' } };

      case 'forward':
        await this.forward();
        return { id: command.id, success: true, data: { navigated: 'forward' } };

      case 'reload':
        await this.reload({ bypassCache: command.bypassCache });
        return { id: command.id, success: true, data: { reloaded: true } };

      case 'getUrl': {
        const url = await this.getUrl();
        return { id: command.id, success: true, data: { url } };
      }

      case 'getTitle': {
        const title = await this.getTitle();
        return { id: command.id, success: true, data: { title } };
      }

      case 'screenshot': {
        const screenshot = await this.screenshot({ format: command.format, quality: command.quality });
        return { id: command.id, success: true, data: { screenshot, format: command.format || 'png' } };
      }

      case 'tabNew': {
        const tab = await this.newTab({ url: command.url, active: command.active });
        return { id: command.id, success: true, data: { tabId: tab.id, url: tab.url } };
      }

      case 'tabClose':
        await this.closeTab(command.tabId);
        return { id: command.id, success: true, data: { closed: command.tabId ?? this.activeTabId } };

      case 'tabSwitch':
        await this.switchTab(command.tabId);
        return { id: command.id, success: true, data: { switched: command.tabId } };

      case 'tabList': {
        const tabs = await this.listTabs();
        return { id: command.id, success: true, data: { tabs } };
      }

      default:
        throw new Error(`Unknown extension action: ${command.action}`);
    }
  }

  waitForTabLoad(tabId, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const checkTab = async () => {
        try {
          const tab = await chrome.tabs.get(tabId);
          if (tab.status === 'complete') {
            resolve();
            return;
          }
          if (Date.now() - startTime > timeout) {
            reject(new Error('Tab load timeout'));
            return;
          }
          setTimeout(checkTab, 100);
        } catch (error) {
          reject(error);
        }
      };
      checkTab();
    });
  }
}

// ============================================================================
// Singleton instance and message listener setup
// ============================================================================

const browserAgent = new BrowserAgent();

// Set up message routing (equivalent to setupMessageListener() from @aspect/extension)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[Background] Received:', message.type);

  if (message.type !== 'aspect:command') {
    return false;
  }

  browserAgent.execute(message.command)
    .then(response => {
      sendResponse({ type: 'aspect:response', response });
    })
    .catch(error => {
      sendResponse({
        type: 'aspect:response',
        response: { id: message.command.id, success: false, error: error.message }
      });
    });

  return true; // Keep channel open for async response
});

// ============================================================================
// Convenience API for popup/external use
// ============================================================================

let commandIdCounter = 0;

function generateCommandId() {
  return `cmd_${Date.now()}_${commandIdCounter++}`;
}

// Expose BrowserAgent methods with auto-generated IDs
globalThis.aspectAgent = {
  // Direct BrowserAgent methods
  navigate: (url, options) => browserAgent.execute({ id: generateCommandId(), action: 'navigate', url, ...options }),
  back: () => browserAgent.execute({ id: generateCommandId(), action: 'back' }),
  forward: () => browserAgent.execute({ id: generateCommandId(), action: 'forward' }),
  reload: (options) => browserAgent.execute({ id: generateCommandId(), action: 'reload', ...options }),
  screenshot: (options) => browserAgent.execute({ id: generateCommandId(), action: 'screenshot', ...options }),
  tabNew: (options) => browserAgent.execute({ id: generateCommandId(), action: 'tabNew', ...options }),
  tabClose: (tabId) => browserAgent.execute({ id: generateCommandId(), action: 'tabClose', tabId }),
  tabSwitch: (tabId) => browserAgent.execute({ id: generateCommandId(), action: 'tabSwitch', tabId }),
  tabList: () => browserAgent.execute({ id: generateCommandId(), action: 'tabList' }),

  // DOM commands (routed to ContentAgent)
  snapshot: (options) => browserAgent.execute({ id: generateCommandId(), action: 'snapshot', ...options }),
  click: (selector) => browserAgent.execute({ id: generateCommandId(), action: 'click', selector }),
  type: (selector, text, options) => browserAgent.execute({ id: generateCommandId(), action: 'type', selector, text, ...options }),
  fill: (selector, value) => browserAgent.execute({ id: generateCommandId(), action: 'fill', selector, value }),

  // Generic execute
  execute: (command) => browserAgent.execute({ id: generateCommandId(), ...command }),
};

console.log('[Aspect] BrowserAgent loaded in background script');
