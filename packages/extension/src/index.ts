/**
 * @btcp/extension
 *
 * Chrome extension bridge for browser automation.
 *
 * Architecture:
 * - BackgroundAgent: Runs in background script, manages tabs/navigation/screenshots
 * - ContentAgent: Runs in content scripts, handles DOM operations (from @btcp/core)
 * - Client: API for sending commands from popup or external scripts
 *
 * @example Background script setup:
 * ```typescript
 * import { BackgroundAgent, setupMessageListener } from '@btcp/extension';
 *
 * // Set up message routing
 * setupMessageListener();
 *
 * // Or use BackgroundAgent directly
 * const agent = new BackgroundAgent();
 * await agent.navigate('https://example.com');
 * await agent.screenshot();
 * ```
 *
 * @example Content script setup:
 * ```typescript
 * import { createContentAgent } from '@btcp/core';
 *
 * const agent = createContentAgent();
 * await agent.execute({ action: 'snapshot' });
 * ```
 *
 * @example Popup/external usage:
 * ```typescript
 * import { createClient } from '@btcp/extension';
 *
 * const client = createClient();
 * await client.navigate('https://example.com');
 * const snapshot = await client.snapshot();
 * await client.click('@ref:5');
 * ```
 */

import type {
  Command,
  ExtensionMessage,
  ExtensionResponse,
  Response,
} from './types.js';

// Import for local use (and re-export below)
import {
  BackgroundAgent as _BackgroundAgent,
  getBackgroundAgent as _getBackgroundAgent,
  setupMessageListener as _setupMessageListener,
  BrowserAgent as _BrowserAgent,
  getBrowserAgent as _getBrowserAgent,
} from './background.js';

export * from './types.js';

// Re-export script messenger types and functions
export {
  createScriptMessenger,
  createMethodMessenger,
  type MessageDefinitions,
  type ScriptMessenger,
  type MethodMessenger,
  type ScriptMessengerOptions,
  type PayloadOf,
  type ResultOf,
} from './script-messenger.js';

// Re-export remote agent for BTCP protocol control
export {
  createRemoteAgent,
  getBrowserToolDefinitions,
  mapToolToCommand,
  formatResponseForBTCP,
  type RemoteAgent,
  type RemoteAgentConfig,
  type RemoteAgentEvents,
  type BTCPToolDefinition,
  type BTCPContent,
} from './remote.js';

// Re-export BackgroundAgent for background script usage
export {
  _BackgroundAgent as BackgroundAgent,
  _getBackgroundAgent as getBackgroundAgent,
  _setupMessageListener as setupMessageListener,
  // Deprecated aliases for backwards compatibility
  _BrowserAgent as BrowserAgent,
  _getBrowserAgent as getBrowserAgent,
};

// Re-export ContentAgent for content script usage
export { createContentAgent, type ContentAgent } from '../../core/dist/index.js';

// Re-export core types
export type {
  SnapshotData,
  BoundingBox,
  Modifier,
} from '../../core/dist/index.js';

/**
 * Client for sending commands to the extension background script
 */
export interface Client {
  /**
   * Execute a raw command
   */
  execute(command: Command): Promise<Response>;

  // --- Navigation ---

  /**
   * Navigate to a URL
   */
  navigate(url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' }): Promise<Response>;

  /**
   * Go back in history
   */
  back(): Promise<Response>;

  /**
   * Go forward in history
   */
  forward(): Promise<Response>;

  /**
   * Reload the page
   */
  reload(options?: { bypassCache?: boolean }): Promise<Response>;

  /**
   * Get the current URL
   */
  getUrl(): Promise<string>;

  /**
   * Get the page title
   */
  getTitle(): Promise<string>;

  // --- DOM ---

  /**
   * Take a snapshot of the page
   */
  snapshot(options?: {
    selector?: string;
    maxDepth?: number;
    mode?: 'interactive' | 'outline' | 'content';
    compact?: boolean;
    format?: 'tree' | 'html' | 'markdown';
    grep?: string;
    maxLength?: number;
    includeLinks?: boolean;
    includeImages?: boolean;
  }): Promise<string>;

  /**
   * Click an element
   */
  click(selector: string, options?: { button?: 'left' | 'right' | 'middle' }): Promise<Response>;

  /**
   * Type text into an element
   */
  type(selector: string, text: string, options?: { delay?: number; clear?: boolean }): Promise<Response>;

  /**
   * Fill an input with a value
   */
  fill(selector: string, value: string): Promise<Response>;

  /**
   * Get text content of an element
   */
  getText(selector: string): Promise<string | null>;

  /**
   * Check if element is visible
   */
  isVisible(selector: string): Promise<boolean>;

  /**
   * Take a screenshot
   */
  screenshot(options?: { format?: 'png' | 'jpeg'; quality?: number }): Promise<string>;

  /**
   * Wait for a selector to appear
   */
  wait(options?: { selector?: string; timeout?: number }): Promise<Response>;

  /**
   * Press a key
   */
  press(key: string, options?: { selector?: string }): Promise<Response>;

  /**
   * Evaluate JavaScript in the page context
   */
  evaluate(expression: string): Promise<unknown>;
}

let commandIdCounter = 0;

/**
 * Generate a unique command ID for BTCP commands
 */
export function generateCommandId(): string {
  return `cmd_${Date.now()}_${commandIdCounter++}`;
}

/**
 * Check if we're running in a background/service worker context
 */
function isBackgroundContext(): boolean {
  // In Manifest V3, background scripts run as service workers
  return typeof ServiceWorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope;
}

/**
 * Create a client for communicating with the extension
 *
 * This function works in both popup/content scripts and background scripts:
 * - In popup/content scripts: Uses chrome.runtime.sendMessage to communicate with background
 * - In background scripts: Uses BackgroundAgent directly for better performance
 *
 * @example Popup usage:
 * ```typescript
 * import { createClient } from '@btcp/browser-agent/extension';
 * const client = createClient();
 * await client.navigate('https://example.com');
 * ```
 *
 * @example Background script usage:
 * ```typescript
 * import { createClient } from '@btcp/browser-agent/extension';
 * const client = createClient();
 * // Works the same way - commands go directly to BackgroundAgent
 * await client.navigate('https://example.com');
 * ```
 */
export function createClient(): Client {
  // Detect if we're in background context
  const inBackground = isBackgroundContext();

  // Lazily get the background agent to avoid circular dependency issues
  let bgAgent: _BackgroundAgent | null = null;

  function getAgent(): _BackgroundAgent {
    if (!bgAgent) {
      // Use the singleton getter from background.js
      bgAgent = _getBackgroundAgent();
    }
    return bgAgent;
  }

  async function sendCommand(command: Command): Promise<Response> {
    // In background context, use BackgroundAgent directly
    if (inBackground) {
      return getAgent().execute(command);
    }

    // In popup/content context, use message passing
    const id = command.id || generateCommandId();
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'btcp:command', command: { ...command, id } } satisfies ExtensionMessage,
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              id,
              success: false,
              error: chrome.runtime.lastError.message || 'Unknown error',
            });
          } else {
            const resp = response as ExtensionResponse;
            if (resp.type === 'btcp:response') {
              resolve(resp.response);
            } else {
              // Unexpected pong response
              resolve({
                id,
                success: false,
                error: 'Unexpected response type',
              });
            }
          }
        }
      );
    });
  }

  function assertSuccess(response: Response): asserts response is Response & { success: true } {
    if (!response.success) {
      throw new Error(response.error);
    }
  }

  return {
    execute: sendCommand,

    // Navigation
    async navigate(url, options) {
      return sendCommand({
        id: generateCommandId(),
        action: 'navigate',
        url,
        waitUntil: options?.waitUntil,
      });
    },

    async back() {
      return sendCommand({ id: generateCommandId(), action: 'back' });
    },

    async forward() {
      return sendCommand({ id: generateCommandId(), action: 'forward' });
    },

    async reload(options) {
      return sendCommand({
        id: generateCommandId(),
        action: 'reload',
        bypassCache: options?.bypassCache,
      });
    },

    async getUrl() {
      const response = await sendCommand({ id: generateCommandId(), action: 'getUrl' });
      assertSuccess(response);
      return (response.data as { url: string }).url;
    },

    async getTitle() {
      const response = await sendCommand({ id: generateCommandId(), action: 'getTitle' });
      assertSuccess(response);
      return (response.data as { title: string }).title;
    },

    // DOM
    async snapshot(options) {
      const response = await sendCommand({
        id: generateCommandId(),
        action: 'snapshot',
        selector: options?.selector,
        maxDepth: options?.maxDepth,
        mode: options?.mode,
        compact: options?.compact,
        format: options?.format,
        grep: options?.grep,
        maxLength: options?.maxLength,
        includeLinks: options?.includeLinks,
        includeImages: options?.includeImages,
      });
      assertSuccess(response);
      return response.data as string;
    },

    async click(selector, options) {
      return sendCommand({
        id: generateCommandId(),
        action: 'click',
        selector,
        button: options?.button,
      });
    },

    async type(selector, text, options) {
      return sendCommand({
        id: generateCommandId(),
        action: 'type',
        selector,
        text,
        delay: options?.delay,
        clear: options?.clear,
      });
    },

    async fill(selector, value) {
      return sendCommand({
        id: generateCommandId(),
        action: 'fill',
        selector,
        value,
      });
    },

    async getText(selector) {
      const response = await sendCommand({
        id: generateCommandId(),
        action: 'getText',
        selector,
      });
      assertSuccess(response);
      return (response.data as { text: string | null }).text;
    },

    async isVisible(selector) {
      const response = await sendCommand({
        id: generateCommandId(),
        action: 'isVisible',
        selector,
      });
      assertSuccess(response);
      return (response.data as { visible: boolean }).visible;
    },

    async screenshot(options) {
      const response = await sendCommand({
        id: generateCommandId(),
        action: 'screenshot',
        format: options?.format,
        quality: options?.quality,
      });
      assertSuccess(response);
      return (response.data as { screenshot: string }).screenshot;
    },

    async wait(options) {
      return sendCommand({
        id: generateCommandId(),
        action: 'wait',
        selector: options?.selector,
        timeout: options?.timeout,
      });
    },

    async press(key, options) {
      return sendCommand({
        id: generateCommandId(),
        action: 'press',
        key,
        selector: options?.selector,
      });
    },

    async evaluate(expression) {
      const response = await sendCommand({
        id: generateCommandId(),
        action: 'evaluate',
        script: expression,
      });
      assertSuccess(response);
      return (response.data as { result: unknown }).result;
    },
  };
}
