/**
 * @btcp/core - Snapshot Types
 *
 * Type definitions for the snapshot API.
 * Each snapshot function has its own options type - TypeScript catches invalid combos.
 */

import type { GrepOptions } from './utils/filter.js';

// Re-export GrepOptions for convenience
export type { GrepOptions } from './utils/filter.js';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Bounding box for element position
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Element reference information
 */
export interface RefInfo {
  selector: string;
  role: string;
  name?: string;
  bbox?: BoundingBox;
  inViewport?: boolean;
  importance?: 'primary' | 'secondary' | 'utility';
  context?: string;
}

/**
 * Snapshot quality level
 */
export type SnapshotQuality = 'high' | 'medium' | 'low';

/**
 * Snapshot metadata
 */
export interface SnapshotMetadata {
  totalInteractiveElements?: number;
  capturedElements?: number;
  quality?: SnapshotQuality;
  depthLimited?: boolean;
  warnings?: string[];
}

/**
 * Full snapshot data structure
 */
export interface SnapshotData {
  tree: string;
  refs: Record<string, RefInfo>;
  metadata?: SnapshotMetadata;
}

/**
 * Element reference map interface
 */
export interface RefMap {
  get(ref: string): Element | null;
  set(ref: string, element: Element): void;
  clear(): void;
  generateRef(element: Element): string;
}

// ============================================================================
// Base Options (shared by multiple functions)
// ============================================================================

/**
 * Base traversal options shared by most snapshot functions
 */
export interface BaseTraverseOptions {
  /** Root element to start snapshot from (default: document.body) */
  root?: Element;
  /** Maximum depth to traverse (default: 50) */
  maxDepth?: number;
  /** Include hidden elements (default: false) */
  includeHidden?: boolean;
}

// ============================================================================
// Per-Function Options (Type-Safe)
// ============================================================================

/**
 * Options for snapshotHead()
 *
 * Minimal by design - returns page metadata without deep traversal.
 * No options needed for the default use case.
 */
export interface HeadOptions {
  /** Root element to start from (default: document.body) */
  root?: Element;
}

/**
 * Options for snapshotInteractive()
 *
 * Find clickable/interactive elements with @ref markers.
 */
export interface InteractiveOptions extends BaseTraverseOptions {
  /** Filter output lines by grep pattern */
  grep?: string | GrepOptions;
}

/**
 * Options for snapshotStructure()
 *
 * High-level page structure with line budget.
 */
export interface StructureOptions extends BaseTraverseOptions {
  /** Maximum number of output lines (default: 100) */
  maxLines?: number;
}

/**
 * Options for snapshotOutline()
 *
 * Structural overview with metadata (landmarks, sections, headings).
 */
export interface OutlineOptions extends BaseTraverseOptions {
  /** Filter output lines by grep pattern */
  grep?: string | GrepOptions;
}

/**
 * Options for snapshotContent()
 *
 * Extract text content from sections.
 */
export interface ContentOptions extends BaseTraverseOptions {
  /** Output format */
  format?: 'tree' | 'markdown';
  /** Filter sections by grep pattern (matches xpath) */
  grep?: string | GrepOptions;
  /** Maximum characters per section (default: 2000) */
  maxLength?: number;
  /** Include links as [text](url) in markdown format (default: true) */
  includeLinks?: boolean;
  /** Include images as ![alt](src) in markdown format (default: false) */
  includeImages?: boolean;
}

/**
 * Options for snapshotAll()
 *
 * Comprehensive view with all elements (interactive + structural).
 */
export interface AllOptions extends BaseTraverseOptions {
  // No additional options - traverse options only
}

// ============================================================================
// Legacy Options (for backward compatibility)
// ============================================================================

/**
 * Snapshot mode (legacy - prefer using specific functions)
 */
export type SnapshotMode = 'interactive' | 'outline' | 'content' | 'head' | 'all' | 'structure';

/**
 * Snapshot output format (legacy)
 */
export type SnapshotFormat = 'tree' | 'html' | 'markdown';

/**
 * Legacy snapshot options (deprecated - use per-function options)
 *
 * @deprecated Use specific function options instead:
 * - HeadOptions for snapshotHead()
 * - InteractiveOptions for snapshotInteractive()
 * - StructureOptions for snapshotStructure()
 * - OutlineOptions for snapshotOutline()
 * - ContentOptions for snapshotContent()
 * - AllOptions for snapshotAll()
 */
export interface LegacySnapshotOptions {
  root?: Element;
  maxDepth?: number;
  includeHidden?: boolean;
  compact?: boolean;
  mode?: SnapshotMode;
  format?: SnapshotFormat;
  grep?: string | GrepOptions;
  maxLength?: number;
  includeLinks?: boolean;
  includeImages?: boolean;
  maxLines?: number;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes for snapshot operations
 */
export type SnapshotErrorCode =
  | 'INVALID_OPTIONS'
  | 'INVALID_ROOT'
  | 'TRAVERSAL_ERROR'
  | 'TIMEOUT';

/**
 * Custom error for snapshot configuration issues
 */
export class SnapshotConfigError extends Error {
  code: SnapshotErrorCode;
  details?: Record<string, unknown>;

  constructor(message: string, code: SnapshotErrorCode, details?: Record<string, unknown>) {
    super(message);
    this.name = 'SnapshotConfigError';
    this.code = code;
    this.details = details;
  }
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate that includeLinks is only used with markdown format
 */
export function validateContentOptions(options: ContentOptions): void {
  if (options.includeLinks !== undefined && options.format !== 'markdown') {
    throw new SnapshotConfigError(
      'includeLinks option requires format: "markdown"',
      'INVALID_OPTIONS',
      { option: 'includeLinks', format: options.format }
    );
  }

  if (options.includeImages !== undefined && options.format !== 'markdown') {
    throw new SnapshotConfigError(
      'includeImages option requires format: "markdown"',
      'INVALID_OPTIONS',
      { option: 'includeImages', format: options.format }
    );
  }
}

/**
 * Validate that root element exists
 */
export function validateRoot(root: Element | undefined | null, document: Document): Element {
  const effectiveRoot = root || document.body;

  if (!effectiveRoot) {
    throw new SnapshotConfigError(
      'No root element available (document.body is null)',
      'INVALID_ROOT'
    );
  }

  return effectiveRoot;
}
