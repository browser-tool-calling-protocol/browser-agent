/**
 * Direct Transport
 *
 * Transport implementation that calls BackgroundAgent.execute() directly,
 * bypassing message passing. Use this in background script context for
 * better performance.
 */

import type { BackgroundAgent } from '../background.js';
import type { Command, Response } from '../types.js';
import { BaseTransport } from './base-transport.js';
import type { TransportOptions } from './types.js';

/**
 * Options for the direct transport
 */
export interface DirectTransportOptions extends TransportOptions {
  /**
   * The BackgroundAgent instance to use for executing commands.
   * This is required since DirectTransport calls execute() directly.
   */
  agent: BackgroundAgent;
}

let commandIdCounter = 0;

/**
 * Generate a unique command ID for BTCP commands
 */
function generateCommandId(): string {
  return `direct_${Date.now()}_${commandIdCounter++}`;
}

/**
 * Direct Transport
 *
 * Executes commands directly via BackgroundAgent.execute() without
 * any message passing. This is more efficient for background script
 * contexts where the agent is available in-process.
 *
 * @example
 * ```typescript
 * import { getBackgroundAgent } from '@btcp/browser-agent/extension';
 * import { createDirectTransport } from '@btcp/browser-agent/extension/transport';
 *
 * const agent = getBackgroundAgent();
 * const transport = createDirectTransport({ agent });
 * const client = createClient({ transport });
 * ```
 */
export class DirectTransport extends BaseTransport {
  readonly name = 'direct';

  private agent: BackgroundAgent;

  constructor(options: DirectTransportOptions) {
    super(options);
    this.agent = options.agent;
    // Direct transport is always "connected" since it's in-process
    this.setState('connected');
  }

  /**
   * Connect the transport (no-op for direct transport)
   */
  async connect(): Promise<void> {
    // Direct transport is always connected
    this.setState('connected');
  }

  /**
   * Disconnect the transport
   */
  disconnect(): void {
    this.setState('disconnected');
  }

  /**
   * Send a command directly to the BackgroundAgent
   */
  async send(command: Command): Promise<Response> {
    if (this.state !== 'connected') {
      const id = command.id || generateCommandId();
      return this.createErrorResponse(id, 'Transport is not connected');
    }

    try {
      const id = command.id || generateCommandId();
      return await this.agent.execute({ ...command, id });
    } catch (error) {
      const id = command.id || generateCommandId();
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.log('error', 'Direct execute error:', error);
      return this.createErrorResponse(id, message);
    }
  }
}

/**
 * Create a direct transport
 *
 * @example
 * ```typescript
 * import { getBackgroundAgent } from '@btcp/browser-agent/extension';
 * import { createDirectTransport } from '@btcp/browser-agent/extension/transport';
 *
 * const transport = createDirectTransport({ agent: getBackgroundAgent() });
 * const client = createClient({ transport });
 * ```
 */
export function createDirectTransport(options: DirectTransportOptions): DirectTransport {
  return new DirectTransport(options);
}
