/**
 * Transport module re-exports
 *
 * This module exports all transport-related types and implementations.
 */

// Types
export type {
  Transport,
  TransportState,
  TransportEvents,
  TransportOptions,
} from './types.js';

// Base class (for custom transport implementations)
export { BaseTransport } from './base-transport.js';

// Chrome extension transport
export {
  ChromeExtensionTransport,
  createChromeExtensionTransport,
  type ChromeExtensionTransportOptions,
} from './chrome-extension.js';

// Direct transport (in-process, for background scripts)
export {
  DirectTransport,
  createDirectTransport,
  type DirectTransportOptions,
} from './direct.js';
