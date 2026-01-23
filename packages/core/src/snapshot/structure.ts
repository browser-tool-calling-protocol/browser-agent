/**
 * @btcp/core - snapshotStructure
 *
 * High-level page structure with line budget.
 * Shows landmarks, headings, and summarized interactive elements.
 *
 * Unix philosophy: Do one thing well - understand page structure.
 */

import type { StructureOptions, SnapshotData, RefMap } from './types.js';
import { validateRoot } from './types.js';
import {
  getRole,
  isVisible,
  isInteractive,
  getAccessibleName,
  buildSemanticXPath,
} from './utils/inspect.js';
import { truncateByType, buildPageHeader, getPageInfo, buildInteractionSummary } from './utils/format.js';
import { countInteractiveDescendants } from './utils/traverse.js';

/**
 * Create a structure snapshot with line budget
 *
 * Returns high-level page structure (landmarks, headings, forms) with
 * summarized interactive element counts. Optimized with breadth-first
 * traversal and lazy statistics collection.
 *
 * @param document - The document to snapshot
 * @param refMap - Reference map (cleared but not populated in structure mode)
 * @param options - Optional configuration
 * @returns SnapshotData with page structure
 *
 * @example
 * ```typescript
 * const refMap = createRefMap();
 * const snapshot = snapshotStructure(document, refMap, { maxLines: 50 });
 *
 * // Output shows landmarks with interaction summaries:
 * // NAVIGATION "Main Nav" [5 links, 2 buttons] /nav.main
 * // MAIN [10 links, 3 inputs] /main
 * //   HEADING level=1 "Welcome" /main/h1
 * ```
 */
export function snapshotStructure(
  document: Document,
  refMap: RefMap,
  options: StructureOptions = {}
): SnapshotData {
  const root = validateRoot(options.root, document);
  const { maxDepth = 50, includeHidden = false, maxLines = 100 } = options;

  refMap.clear();
  const lines: string[] = [];
  const processedElements = new Set<Element>();

  // Landmark roles we want to show
  const landmarkRoles = new Set([
    'banner', 'navigation', 'main', 'complementary',
    'contentinfo', 'search', 'region', 'form'
  ]);

  // Breadth-first traversal with line budget
  interface QueueItem {
    element: Element;
    depth: number;
    indent: string;
  }

  const queue: QueueItem[] = [{ element: root, depth: 0, indent: '' }];
  let currentLineCount = 0;
  let truncated = false;

  while (queue.length > 0 && currentLineCount < maxLines) {
    const { element, depth, indent } = queue.shift()!;

    if (depth > maxDepth) continue;
    if (processedElements.has(element)) continue;

    // For structure mode: check semantic significance BEFORE visibility
    // This prevents filtering out landmarks/headings that have CSS visibility issues
    // due to missing external stylesheets in saved snapshots
    const role = getRole(element);
    const tag = element.tagName.toLowerCase();

    const isLandmark = role && landmarkRoles.has(role);
    const isHeading = role === 'heading' || /^h[1-6]$/.test(tag);
    const isFormElement = role === 'form' || tag === 'form';
    const isSemanticElement = isLandmark || isHeading || isFormElement;

    // Check visibility, but ALWAYS accept semantic elements regardless of CSS visibility
    const skipVisibilityCheck = isSemanticElement;
    if (!includeHidden && !skipVisibilityCheck && !isVisible(element, false)) {
      // Still queue children - they might be visible
      for (const child of element.children) {
        queue.push({ element: child, depth: depth + 1, indent });
      }
      continue;
    }

    processedElements.add(element);

    if (!isLandmark && !isHeading && !isFormElement) {
      // Not showing this element, but queue its children to continue search
      for (const child of element.children) {
        queue.push({ element: child, depth: depth + 1, indent });
      }
      continue;
    }

    // Check if we have budget for this line
    if (currentLineCount >= maxLines) {
      truncated = true;
      break;
    }

    // We're showing this element - build the line with xpath
    const name = getAccessibleName(element);
    const roleUpper = (role || tag).toUpperCase();
    const xpath = buildSemanticXPath(element);

    let line = indent + roleUpper;

    if (name) {
      line += ` "${truncateByType(name, 'ELEMENT_NAME')}"`;
    }

    // For landmarks and forms, add interaction summary (computed lazily)
    if (isLandmark || isFormElement) {
      const counts = countInteractiveDescendants(element, isInteractive, getRole);
      const summary = buildInteractionSummary(counts);
      if (summary) {
        line += ` ${summary}`;
      }
    }

    // Add xpath
    line += ` ${xpath}`;

    lines.push(line);
    currentLineCount++;

    // Always queue children of shown elements to find nested structure
    for (const child of element.children) {
      queue.push({ element: child, depth: depth + 1, indent: indent + '  ' });
    }
  }

  // Build headers
  const pageInfo = getPageInfo(document);
  const pageHeader = buildPageHeader(pageInfo);

  const totalElements = lines.length;
  const snapshotHeader = `STRUCTURE: elements=${totalElements} maxLines=${maxLines}${truncated ? ' (truncated)' : ''}`;

  // Combine headers and content
  const fullTree = [pageHeader, snapshotHeader, '', ...lines].join('\n');

  return {
    tree: fullTree,
    refs: {},
    metadata: {
      capturedElements: totalElements,
      quality: truncated ? 'medium' : 'high'
    }
  };
}
