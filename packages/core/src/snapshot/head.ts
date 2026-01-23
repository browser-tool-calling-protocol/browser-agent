/**
 * @btcp/core - snapshotHead
 *
 * Lightweight HTTP HEAD-style page overview.
 * Returns page metadata without deep DOM traversal for fast verification.
 *
 * Unix philosophy: Do one thing well - quick page status check.
 */

import type { HeadOptions, SnapshotData } from './types.js';
import { validateRoot } from './types.js';

/**
 * Create a lightweight page overview snapshot
 *
 * Returns page metadata (URL, title, element counts, status) without
 * generating element refs or deep traversal. Use this for:
 * - Quick page load verification
 * - Checking if page has interactive content
 * - Fast status checks before deeper snapshots
 *
 * @param document - The document to snapshot
 * @param options - Optional configuration
 * @returns SnapshotData with page overview (no refs)
 *
 * @example
 * ```typescript
 * // Quick page status check
 * const snapshot = snapshotHead(document);
 * console.log(snapshot.tree);
 * // URL: https://example.com
 * // TITLE: Example Page
 * // VIEWPORT: 1920x1080
 * // STATUS: ready
 * // ELEMENTS: total=150 interactive=25
 * // READY_STATE: complete
 * ```
 */
export function snapshotHead(
  document: Document,
  options: HeadOptions = {}
): SnapshotData {
  const root = validateRoot(options.root, document);
  const win = document.defaultView || (typeof window !== 'undefined' ? window : null);

  // Get window dimensions safely
  const viewportWidth = win?.innerWidth ?? 1024;
  const viewportHeight = win?.innerHeight ?? 768;

  // Count elements (lightweight - no deep traversal)
  const allElements = root.querySelectorAll('*');
  const interactiveSelector = 'button, a[href], input, textarea, select, [role="button"], [tabindex]:not([tabindex="-1"])';
  const interactiveElements = root.querySelectorAll(interactiveSelector);

  // Page status detection
  const viewportArea = viewportWidth * viewportHeight;
  const hasInteractive = interactiveElements.length > 0;
  const isComplete = document.readyState === 'complete';

  let status = 'loading';
  if (viewportArea === 0) {
    status = 'loading';
  } else if (!hasInteractive) {
    status = 'empty';
  } else if (isComplete) {
    status = 'ready';
  } else {
    status = 'interactive';
  }

  // Build output
  const output = [
    `URL: ${document.location?.href || 'about:blank'}`,
    `TITLE: ${document.title || 'Untitled'}`,
    `VIEWPORT: ${viewportWidth}x${viewportHeight}`,
    `STATUS: ${status}`,
    `ELEMENTS: total=${allElements.length} interactive=${interactiveElements.length}`,
    `READY_STATE: ${document.readyState}`
  ].join('\n');

  return {
    tree: output,
    refs: {},  // No refs in head mode
    metadata: {
      totalInteractiveElements: interactiveElements.length,
      capturedElements: 0,
      quality: 'high'
    }
  };
}
