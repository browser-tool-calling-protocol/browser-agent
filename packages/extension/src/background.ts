/**
 * @aspect/extension - Background Script
 *
 * Contains BrowserAgent - the high-level orchestrator that runs in the
 * extension's background/service worker context.
 *
 * BrowserAgent manages:
 * - Tab lifecycle (create, close, switch, list)
 * - Navigation (goto, back, forward, reload)
 * - Screenshots (chrome.tabs.captureVisibleTab)
 * - Session state
 * - Routing DOM commands to ContentAgents in target tabs
 */

import type {
  Command,
  ExtensionCommand,
  ExtensionMessage,
  ExtensionResponse,
  Response,
  TabInfo,
  ChromeTab,
} from './types.js';

/**
 * BrowserAgent - High-level browser automation orchestrator
 *
 * Runs in the extension's background script/service worker.
 * Manages browser-level operations and routes DOM commands to
 * ContentAgent instances running in content scripts.
 *
 * @example
 * ```typescript
 * // In background.ts
 * const browser = new BrowserAgent();
 *
 * // Navigate to a URL
 * await browser.navigate('https://example.com');
 *
 * // Take a screenshot
 * const screenshot = await browser.screenshot();
 *
 * // Execute a DOM command (routed to content script)
 * await browser.execute({ id: '1', action: 'click', selector: '#submit' });
 * ```
 */
export class BrowserAgent {
  private activeTabId: number | null = null;

  constructor() {
    // Initialize active tab on creation
    this.initActiveTab();
  }

  private async initActiveTab(): Promise<void> {
    const tab = await this.getActiveTab();
    this.activeTabId = tab?.id ?? null;
  }

  // ============================================================================
  // TAB MANAGEMENT
  // ============================================================================

  /**
   * Get the currently active tab
   */
  async getActiveTab(): Promise<ChromeTab | null> {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0] || null);
      });
    });
  }

  /**
   * List all tabs in the current window
   */
  async listTabs(): Promise<TabInfo[]> {
    const tabs = await new Promise<ChromeTab[]>((resolve) => {
      chrome.tabs.query({ currentWindow: true }, (t) => resolve(t));
    });

    return tabs.map((t) => ({
      id: t.id!,
      url: t.url,
      title: t.title,
      active: t.active,
      index: t.index,
    }));
  }

  /**
   * Create a new tab
   */
  async newTab(options?: { url?: string; active?: boolean }): Promise<TabInfo> {
    const tab = await new Promise<ChromeTab>((resolve) => {
      chrome.tabs.create(
        { url: options?.url, active: options?.active ?? true },
        (t) => resolve(t)
      );
    });

    if (options?.url) {
      await this.waitForTabLoad(tab.id!);
    }

    if (options?.active !== false) {
      this.activeTabId = tab.id!;
    }

    return {
      id: tab.id!,
      url: tab.url,
      title: tab.title,
      active: tab.active,
      index: tab.index,
    };
  }

  /**
   * Close a tab
   */
  async closeTab(tabId?: number): Promise<void> {
    const targetId = tabId ?? this.activeTabId;
    if (!targetId) throw new Error('No tab to close');

    await new Promise<void>((resolve) => {
      chrome.tabs.remove(targetId, () => resolve());
    });

    // Update active tab if we closed the current one
    if (targetId === this.activeTabId) {
      const tab = await this.getActiveTab();
      this.activeTabId = tab?.id ?? null;
    }
  }

  /**
   * Switch to a tab
   */
  async switchTab(tabId: number): Promise<void> {
    await new Promise<void>((resolve) => {
      chrome.tabs.update(tabId, { active: true }, () => resolve());
    });
    this.activeTabId = tabId;
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  /**
   * Navigate to a URL
   */
  async navigate(url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' }): Promise<void> {
    const tabId = this.activeTabId ?? (await this.getActiveTab())?.id;
    if (!tabId) throw new Error('No active tab');

    await new Promise<void>((resolve) => {
      chrome.tabs.update(tabId, { url }, () => resolve());
    });

    if (options?.waitUntil) {
      await this.waitForTabLoad(tabId);
    }
  }

  /**
   * Go back in history
   */
  async back(): Promise<void> {
    const tabId = this.activeTabId ?? (await this.getActiveTab())?.id;
    if (!tabId) throw new Error('No active tab');

    await new Promise<void>((resolve) => {
      chrome.tabs.goBack(tabId, () => resolve());
    });
  }

  /**
   * Go forward in history
   */
  async forward(): Promise<void> {
    const tabId = this.activeTabId ?? (await this.getActiveTab())?.id;
    if (!tabId) throw new Error('No active tab');

    await new Promise<void>((resolve) => {
      chrome.tabs.goForward(tabId, () => resolve());
    });
  }

  /**
   * Reload the current page
   */
  async reload(options?: { bypassCache?: boolean }): Promise<void> {
    const tabId = this.activeTabId ?? (await this.getActiveTab())?.id;
    if (!tabId) throw new Error('No active tab');

    await new Promise<void>((resolve) => {
      chrome.tabs.reload(tabId, { bypassCache: options?.bypassCache }, () => resolve());
    });

    await this.waitForTabLoad(tabId);
  }

  /**
   * Get the current URL
   */
  async getUrl(): Promise<string> {
    const tab = await this.getActiveTab();
    return tab?.url || '';
  }

  /**
   * Get the page title
   */
  async getTitle(): Promise<string> {
    const tab = await this.getActiveTab();
    return tab?.title || '';
  }

  // ============================================================================
  // SCREENSHOTS
  // ============================================================================

  /**
   * Capture a screenshot of the visible tab
   */
  async screenshot(options?: { format?: 'png' | 'jpeg'; quality?: number }): Promise<string> {
    const format = options?.format || 'png';
    const quality = options?.quality;

    const dataUrl = await new Promise<string>((resolve, reject) => {
      chrome.tabs.captureVisibleTab(
        null,
        { format, quality },
        (url) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(url);
          }
        }
      );
    });

    // Extract base64 data from data URL
    return dataUrl.split(',')[1];
  }

  // ============================================================================
  // COMMAND EXECUTION
  // ============================================================================

  /**
   * Execute a command - routes to appropriate handler
   *
   * Browser-level commands (navigate, screenshot, tabs) are handled here.
   * DOM-level commands are forwarded to the ContentAgent in the target tab.
   */
  async execute(command: Command): Promise<Response> {
    try {
      // Extension commands are handled directly by BrowserAgent
      if (this.isExtensionCommand(command)) {
        return this.executeExtensionCommand(command);
      }

      // DOM commands are forwarded to ContentAgent in the target tab
      return this.sendToContentAgent(command);
    } catch (error) {
      return {
        id: command.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Send a command to the ContentAgent in a specific tab
   */
  async sendToContentAgent(command: Command, tabId?: number): Promise<Response> {
    const targetTabId = tabId ?? this.activeTabId ?? (await this.getActiveTab())?.id;

    if (!targetTabId) {
      return {
        id: command.id,
        success: false,
        error: 'No active tab for DOM command',
      };
    }

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(
        targetTabId,
        { type: 'aspect:command', command } satisfies ExtensionMessage,
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              id: command.id,
              success: false,
              error: chrome.runtime.lastError.message || 'Failed to send message to tab',
            });
          } else {
            const resp = response as ExtensionResponse;
            resolve(resp.response);
          }
        }
      );
    });
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private isExtensionCommand(command: Command): command is ExtensionCommand {
    const extensionActions = [
      'navigate', 'back', 'forward', 'reload',
      'getUrl', 'getTitle', 'screenshot',
      'tabNew', 'tabClose', 'tabSwitch', 'tabList',
    ];
    return extensionActions.includes(command.action);
  }

  private async executeExtensionCommand(command: ExtensionCommand): Promise<Response> {
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
        const screenshot = await this.screenshot({
          format: command.format,
          quality: command.quality,
        });
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
        throw new Error(`Unknown extension action: ${(command as ExtensionCommand).action}`);
    }
  }

  private waitForTabLoad(tabId: number, timeout = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkTab = () => {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (tab.status === 'complete') {
            resolve();
            return;
          }

          if (Date.now() - startTime > timeout) {
            reject(new Error('Tab load timeout'));
            return;
          }

          setTimeout(checkTab, 100);
        });
      };

      checkTab();
    });
  }
}

// ============================================================================
// MESSAGE LISTENER SETUP
// ============================================================================

// Singleton instance for message handling
let browserAgent: BrowserAgent | null = null;

/**
 * Get or create the BrowserAgent singleton
 */
export function getBrowserAgent(): BrowserAgent {
  if (!browserAgent) {
    browserAgent = new BrowserAgent();
  }
  return browserAgent;
}

/**
 * Set up the message listener for the background script
 * Call this once in your background.ts to enable command routing
 */
export function setupMessageListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const msg = message as ExtensionMessage;

    if (msg.type !== 'aspect:command') {
      return false;
    }

    const agent = getBrowserAgent();

    // Execute the command (BrowserAgent handles routing to correct tab)
    agent.execute(msg.command)
      .then((response) => {
        sendResponse({ type: 'aspect:response', response } satisfies ExtensionResponse);
      })
      .catch((error) => {
        sendResponse({
          type: 'aspect:response',
          response: {
            id: msg.command.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          },
        } satisfies ExtensionResponse);
      });

    return true; // Keep channel open for async response
  });
}

// Legacy exports for backwards compatibility
export const handleCommand = (command: Command, _tabId?: number) =>
  getBrowserAgent().execute(command);

export const executeExtensionCommand = (command: ExtensionCommand) =>
  getBrowserAgent().execute(command);

export const sendToContentScript = (_tabId: number, command: Command) =>
  getBrowserAgent().sendToContentAgent(command, _tabId);
