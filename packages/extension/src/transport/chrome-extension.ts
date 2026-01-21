/**
 * Chrome Extension Transport
 *
 * Transport implementation that uses chrome.runtime.sendMessage to communicate
 * with the background script.
 */

import type {
  Command,
  ExtensionMessage,
  ExtensionResponse,
  Response,
} from '../types.js';
import { BaseTransport } from './base-transport.js';
import type { TransportOptions } from './types.js';

/**
 * Options for the Chrome extension transport
 */
export interface ChromeExtensionTransportOptions extends TransportOptions {
  /**
   * Whether to auto-connect on first send
   * @default true
   */
  autoConnect?: boolean;
}

let commandIdCounter = 0;

/**
 * Generate a unique command ID for BTCP commands
 */
function generateCommandId(): string {
  return `cmd_${Date.now()}_${commandIdCounter++}`;
}

/**
 * Chrome Extension Transport
 *
 * Uses chrome.runtime.sendMessage to send commands to the background script.
 * This is the default transport for popup and content script contexts.
 *
 * @example
 * ```typescript
 * const transport = new ChromeExtensionTransport({ debug: true });
 * await transport.connect();
 * const response = await transport.send({ action: 'navigate', url: 'https://example.com' });
 * ```
 */
export class ChromeExtensionTransport extends BaseTransport {
  readonly name = 'chrome-extension';

  private autoConnect: boolean;
  private initPromise: Promise<void> | null = null;

  constructor(options: ChromeExtensionTransportOptions = {}) {
    super(options);
    this.autoConnect = options.autoConnect ?? true;
  }

  /**
   * Connect to the background script
   *
   * Sends a popupInitialize command to reconnect to any existing session.
   */
  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }

    this.setState('connecting');

    try {
      // Send popupInitialize to reconnect to existing session
      await this.sendRaw({
        id: generateCommandId(),
        action: 'popupInitialize',
      });
      this.setState('connected');
    } catch (error) {
      // Silent fail - session will be created on first tool use if needed
      // Still mark as connected since messaging works
      this.log('debug', 'popupInitialize failed (session will be created on demand):', error);
      this.setState('connected');
    }
  }

  /**
   * Disconnect the transport
   */
  disconnect(): void {
    if (this.state === 'disconnected') {
      return;
    }
    this.initPromise = null;
    this.setState('disconnected');
  }

  /**
   * Send a command to the background script
   */
  async send(command: Command): Promise<Response> {
    // Auto-connect on first send if enabled
    if (this.autoConnect && this.state === 'disconnected') {
      await this.ensureConnected();
    }

    const id = command.id || generateCommandId();
    return this.sendRaw({ ...command, id });
  }

  /**
   * Ensure the transport is connected (lazy initialization)
   */
  private async ensureConnected(): Promise<void> {
    if (this.state === 'connected') {
      return;
    }

    if (this.initPromise === null) {
      this.initPromise = this.connect();
    }
    return this.initPromise;
  }

  /**
   * Send a command without auto-connect (used for popupInitialize itself)
   */
  private sendRaw(command: Command): Promise<Response> {
    const id = command.id || generateCommandId();

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'btcp:command', command: { ...command, id } } satisfies ExtensionMessage,
        (response) => {
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError.message || 'Unknown error';
            this.log('debug', 'sendMessage error:', error);
            resolve(this.createErrorResponse(id, error));
          } else {
            const resp = response as ExtensionResponse;
            if (resp?.type === 'btcp:response') {
              resolve(resp.response);
            } else {
              resolve(this.createErrorResponse(id, 'Unexpected response type'));
            }
          }
        }
      );
    });
  }
}

/**
 * Create a Chrome extension transport
 *
 * @example
 * ```typescript
 * const transport = createChromeExtensionTransport({ debug: true });
 * const client = createClient({ transport });
 * ```
 */
export function createChromeExtensionTransport(
  options: ChromeExtensionTransportOptions = {}
): ChromeExtensionTransport {
  return new ChromeExtensionTransport(options);
}
