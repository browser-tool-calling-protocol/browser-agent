/**
 * @btcp/core - Snapshot Module
 *
 * Unix-style snapshot API with separate functions per mode.
 *
 * Primary functions (use these):
 * - snapshotHead() - Quick page status check
 * - snapshotInteractive() - Find clickable elements (default for AI agents)
 * - snapshotStructure() - Page structure with line budget
 * - snapshotOutline() - Structural overview with metadata
 * - snapshotContent() - Extract text content (tree format)
 * - snapshotAll() - Comprehensive view with all elements
 *
 * Content extraction:
 * - extract() - Transform content to HTML or Markdown
 *
 * Utilities (for advanced use):
 * - traverse.* - DOM traversal generators
 * - filter.* - Grep and filtering utilities
 * - inspect.* - Element inspection utilities
 * - format.* - Output formatting utilities
 */

// ============================================================================
// Primary Snapshot Functions
// ============================================================================

export { snapshotHead } from './head.js';
export { snapshotInteractive } from './interactive.js';
export { snapshotStructure } from './structure.js';
export { snapshotOutline } from './outline.js';
export { snapshotContent } from './content.js';
export { snapshotAll } from './all.js';

// ============================================================================
// Content Extraction
// ============================================================================

export { extract, type ExtractOptions } from './extract.js';

// ============================================================================
// Backward Compatibility
// ============================================================================

export { createSnapshot } from './compat.js';

// ============================================================================
// Types
// ============================================================================

export type {
  // Core types
  BoundingBox,
  RefInfo,
  SnapshotQuality,
  SnapshotMetadata,
  SnapshotData,
  RefMap,

  // Per-function options (type-safe)
  HeadOptions,
  InteractiveOptions,
  StructureOptions,
  OutlineOptions,
  ContentOptions,
  AllOptions,
  BaseTraverseOptions,

  // Legacy types (for backward compatibility)
  SnapshotMode,
  SnapshotFormat,
  LegacySnapshotOptions,

  // Error types
  SnapshotErrorCode,
} from './types.js';

export { SnapshotConfigError, validateRoot } from './types.js';

// ============================================================================
// Utilities (Advanced Use)
// ============================================================================

// Re-export utilities for advanced users
export * as inspect from './utils/inspect.js';
export * as filter from './utils/filter.js';
export * as traverse from './utils/traverse.js';
export * as format from './utils/format.js';

// Also export commonly used utilities directly
export {
  type GrepOptions,
  type GrepResult,
  grepLines,
  grepItems,
  matchesGrep,
} from './utils/filter.js';

export {
  type TraverseOptions,
  traverseElements,
  traverseBreadthFirst,
  collectElements,
} from './utils/traverse.js';

export {
  getRole,
  isInteractive,
  isVisible,
  getAccessibleName,
  buildSemanticXPath,
  generateSelector,
  LANDMARK_ROLES,
} from './utils/inspect.js';
