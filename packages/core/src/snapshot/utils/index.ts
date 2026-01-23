/**
 * @btcp/core - Snapshot Utilities
 *
 * Re-exports all snapshot utilities for convenient importing.
 */

// Inspection utilities
export {
  getHTMLConstructors,
  getRole,
  isInteractive,
  isVisible,
  isInViewport,
  getAccessibleName,
  getInputAttributes,
  getSemanticClass,
  buildSemanticXPath,
  generateSelector,
  generateSimpleSelector,
  getSectionName,
  LANDMARK_ROLES,
  isLandmark,
} from './inspect.js';

// Filter utilities
export {
  type GrepOptions,
  type GrepResult,
  grepLines,
  grepItems,
  matchesGrep,
  filterVisible,
  filterElements,
  countWords,
  getCleanTextContent,
  countChildElements,
  getListItems,
  detectCodeLanguage,
} from './filter.js';

// Traversal utilities
export {
  type TraverseOptions,
  traverseElements,
  traverseBreadthFirst,
  traverseInteractive,
  traverseLandmarks,
  traverseHeadings,
  collectElements,
  collectMatching,
  countInteractiveDescendants,
  countElements,
} from './traverse.js';

// Format utilities
export {
  TRUNCATE_LIMITS,
  truncateByType,
  truncate,
  type PageInfo,
  buildPageHeader,
  getPageInfo,
  type SnapshotHeaderOptions,
  buildSnapshotHeader,
  type ElementLineOptions,
  buildElementLine,
  buildOutlineMetadata,
  buildInteractionSummary,
  buildContentSectionHeader,
  buildCodeBlockOutput,
  buildListOutput,
  buildMarkdownHeading,
  buildMarkdownListItem,
  buildMarkdownCodeBlock,
  buildMarkdownBlockquote,
  buildMarkdownImage,
  joinOutputSections,
  buildSnapshotOutput,
} from './format.js';
