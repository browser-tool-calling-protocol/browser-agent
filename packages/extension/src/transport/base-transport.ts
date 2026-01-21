/**
 * Base transport class with shared functionality
 *
 * Provides event handling, state management, and utility methods for transports.
 */

import type { Command, Response } from '../types.js';
import type { Transport, TransportEvents, TransportOptions, TransportState } from './types.js';

/**
 * Abstract base class for transports
 *
 * Provides common functionality for event handling and state management.
 * Subclasses must implement `send()`, `connect()`, and `disconnect()`.
 */
export abstract class BaseTransport implements Transport {
  abstract readonly name: string;

  protected state: TransportState = 'disconnected';
  protected debug: boolean;

  private eventHandlers: Map<keyof TransportEvents, Set<TransportEvents[keyof TransportEvents]>> =
    new Map();

  constructor(options: TransportOptions = {}) {
    this.debug = options.debug ?? false;
  }

  /**
   * Send a command - must be implemented by subclasses
   */
  abstract send(command: Command): Promise<Response>;

  /**
   * Connect the transport - must be implemented by subclasses
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect the transport - must be implemented by subclasses
   */
  abstract disconnect(): void;

  /**
   * Get the current connection state
   */
  getState(): TransportState {
    return this.state;
  }

  /**
   * Check if the transport is connected
   */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Register an event handler
   */
  on<K extends keyof TransportEvents>(event: K, handler: TransportEvents[K]): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler as TransportEvents[keyof TransportEvents]);
  }

  /**
   * Unregister an event handler
   */
  off<K extends keyof TransportEvents>(event: K, handler: TransportEvents[K]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler as TransportEvents[keyof TransportEvents]);
    }
  }

  /**
   * Emit an event to all registered handlers
   */
  protected emit<K extends keyof TransportEvents>(
    event: K,
    ...args: Parameters<TransportEvents[K]>
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          (handler as (...args: unknown[]) => void)(...args);
        } catch (error) {
          this.log('error', `Error in event handler for "${event}":`, error);
        }
      }
    }
  }

  /**
   * Update the transport state and emit stateChange event
   */
  protected setState(newState: TransportState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this.log('debug', `State changed: ${oldState} -> ${newState}`);
      this.emit('stateChange', newState);

      // Also emit specific events
      if (newState === 'connected') {
        this.emit('connected');
      } else if (newState === 'disconnected') {
        this.emit('disconnected');
      }
    }
  }

  /**
   * Log a message if debug is enabled
   */
  protected log(level: 'debug' | 'info' | 'warn' | 'error', ...args: unknown[]): void {
    if (!this.debug && level === 'debug') {
      return;
    }
    const prefix = `[${this.name}]`;
    switch (level) {
      case 'debug':
      case 'info':
        console.log(prefix, ...args);
        break;
      case 'warn':
        console.warn(prefix, ...args);
        break;
      case 'error':
        console.error(prefix, ...args);
        break;
    }
  }

  /**
   * Create an error response with the given message
   */
  protected createErrorResponse(id: string, error: string): Response {
    return {
      id,
      success: false,
      error,
    };
  }
}
