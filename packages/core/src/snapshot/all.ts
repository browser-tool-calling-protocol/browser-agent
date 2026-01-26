/**
 * @btcp/core - snapshotAll
 *
 * Comprehensive view with all elements (interactive + structural).
 * Returns everything: landmarks, sections, headings, interactive elements.
 *
 * Unix philosophy: Complete data dump when you need everything.
 */

import type { AllOptions, SnapshotData, RefMap } from './types.js';
import { validateRoot } from './types.js';
import {
  getRole,
  isInteractive,
  getAccessibleName,
  buildSemanticXPath,
  generateSelector,
} from './utils/inspect.js';
import { truncateByType, buildPageHeader, getPageInfo } from './utils/format.js';
import { collectElements } from './utils/traverse.js';

/**
 * Create a comprehensive snapshot of all elements
 *
 * Returns all elements with roles (interactive + structural) with @ref markers.
 * Use when you need complete visibility into the page structure.
 *
 * @param document - The document to snapshot
 * @param refMap - Reference map to store element refs
 * @param options - Optional configuration
 * @returns SnapshotData with all elements and refs
 *
 * @example
 * ```typescript
 * const refMap = createRefMap();
 * const snapshot = snapshotAll(document, refMap);
 *
 * // Contains both interactive and structural elements:
 * // NAVIGATION "Main Nav" @ref:0 /nav
 * // LINK "Home" @ref:1 /nav/a[1]
 * // LINK "About" @ref:2 /nav/a[2]
 * // MAIN @ref:3 /main
 * // HEADING level=1 "Welcome" @ref:4 /main/h1
 * // BUTTON "Submit" @ref:5 /main/form/button
 * ```
 */
export function snapshotAll(
  document: Document,
  refMap: RefMap,
  options: AllOptions = {}
): SnapshotData {
  const root = validateRoot(options.root, document);
  const { maxDepth = 50, includeHidden = false } = options;

  refMap.clear();
  const lines: string[] = [];
  let refCounter = 0;
  const refs: SnapshotData['refs'] = {};

  // Collect all elements
  const elements = collectElements(root, { maxDepth, includeHidden, checkAncestors: false });

  // Track interactive count for metadata
  let interactiveCount = 0;

  // Process ALL elements (no filtering)
  for (const element of elements) {
    const role = getRole(element);
    const isInteractiveElement = isInteractive(element);

    if (isInteractiveElement) interactiveCount++;

    // Include ALL elements with a role or that are interactive
    if (!role && !isInteractiveElement) continue;

    const name = getAccessibleName(element);

    // Build line
    let line = '';

    if (role) {
      const roleUpper = role.toUpperCase();
      line = roleUpper;

      if (name) {
        line += ` "${truncateByType(name, 'ELEMENT_NAME')}"`;
      }

      // Generate ref for ALL elements with roles
      const ref = `@ref:${refCounter++}`;
      refMap.set(ref, element);
      line += ` ${ref}`;

      try {
        const bbox = element.getBoundingClientRect();
        refs[ref] = {
          selector: generateSelector(element),
          role: role.split(' ')[0],
          name: name || undefined,
          bbox: {
            x: Math.round(bbox.x),
            y: Math.round(bbox.y),
            width: Math.round(bbox.width),
            height: Math.round(bbox.height),
          },
        };
      } catch {
        refs[ref] = {
          selector: generateSelector(element),
          role: role.split(' ')[0],
          name: name || undefined,
        };
      }

      // Add xpath path
      line += ` ${buildSemanticXPath(element)}`;
    }

    lines.push(line);
  }

  // Build page header
  const pageInfo = getPageInfo(document);
  const pageHeader = buildPageHeader(pageInfo);

  const subheader = `ALL: elements=${lines.length} refs=${refCounter}`;
  const tree = [pageHeader, subheader, '', ...lines].join('\n');

  return {
    tree,
    refs,
    metadata: {
      totalInteractiveElements: interactiveCount,
      capturedElements: lines.length,
      quality: 'high'
    }
  };
}
