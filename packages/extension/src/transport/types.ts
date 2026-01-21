/**
 * Transport abstraction for the client API
 *
 * This module defines the transport interface that allows the client to use
 * different communication mechanisms (Chrome extension messaging, HTTP, WebSocket, etc.)
 */

import type { Command, Response } from '../types.js';

/**
 * Transport connection state
 */
export type TransportState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Events emitted by transports
 */
export interface TransportEvents {
  /** Transport connected successfully */
  connected: () => void;
  /** Transport disconnected */
  disconnected: (reason?: string) => void;
  /** Transport encountered an error */
  error: (error: Error) => void;
  /** Transport state changed */
  stateChange: (state: TransportState) => void;
}

/**
 * Base transport options shared by all transports
 */
export interface TransportOptions {
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Transport interface for sending commands to the backend
 *
 * Transports handle the communication layer between the client and the
 * command execution backend (background script, HTTP server, etc.)
 */
export interface Transport {
  /**
   * Human-readable name for this transport (e.g., 'chrome-extension', 'http')
   */
  readonly name: string;

  /**
   * Send a command and wait for the response
   */
  send(command: Command): Promise<Response>;

  /**
   * Connect the transport (if applicable)
   * Some transports may be stateless and not require connection
   */
  connect(): Promise<void>;

  /**
   * Disconnect the transport and clean up resources
   */
  disconnect(): void;

  /**
   * Get the current connection state
   */
  getState(): TransportState;

  /**
   * Check if the transport is currently connected
   */
  isConnected(): boolean;

  /**
   * Register an event handler
   */
  on<K extends keyof TransportEvents>(event: K, handler: TransportEvents[K]): void;

  /**
   * Unregister an event handler
   */
  off<K extends keyof TransportEvents>(event: K, handler: TransportEvents[K]): void;
}
