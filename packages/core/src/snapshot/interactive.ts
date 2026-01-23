/**
 * @btcp/core - snapshotInteractive
 *
 * Find clickable/interactive elements with @ref markers.
 * Default snapshot mode for AI agent interaction.
 *
 * Unix philosophy: Do one thing well - find interactive elements.
 */

import type { InteractiveOptions, SnapshotData, RefMap } from './types.js';
import { validateRoot } from './types.js';
import {
  getRole,
  isInteractive,
  isInViewport,
  getAccessibleName,
  getInputAttributes,
  buildSemanticXPath,
  generateSelector,
  generateSimpleSelector,
} from './utils/inspect.js';
import { grepLines } from './utils/filter.js';
import {
  truncateByType,
  buildPageHeader,
  getPageInfo,
  buildSnapshotOutput,
} from './utils/format.js';
import { collectElements } from './utils/traverse.js';

/**
 * Create a snapshot of interactive elements
 *
 * Returns all interactive elements (buttons, links, inputs, etc.) with
 * @ref markers for AI agent interaction. This is the default snapshot mode.
 *
 * @param document - The document to snapshot
 * @param refMap - Reference map to store element refs
 * @param options - Optional configuration
 * @returns SnapshotData with interactive elements and refs
 *
 * @example
 * ```typescript
 * const refMap = createRefMap();
 * const snapshot = snapshotInteractive(document, refMap);
 *
 * // Use refs to interact with elements
 * await agent.execute({ action: 'click', selector: '@ref:5' });
 * ```
 */
export function snapshotInteractive(
  document: Document,
  refMap: RefMap,
  options: InteractiveOptions = {}
): SnapshotData {
  const root = validateRoot(options.root, document);
  const { maxDepth = 50, includeHidden = false, grep: grepPattern } = options;

  refMap.clear();

  const win = document.defaultView || (typeof window !== 'undefined' ? window : null);
  const refs: SnapshotData['refs'] = {};
  const lines: string[] = [];
  let refCounter = 0;

  // Collect all elements with traversal
  const elements = collectElements(root, { maxDepth, includeHidden, checkAncestors: false });

  // Filter and process elements
  let totalInteractive = 0;
  let capturedInteractive = 0;

  for (const element of elements) {
    const role = getRole(element);
    const isInteractiveElement = isInteractive(element);

    if (isInteractiveElement) totalInteractive++;

    // Skip non-interactive elements in interactive mode
    if (!isInteractiveElement) continue;

    // Skip elements without role
    if (!role) continue;

    const name = getAccessibleName(element);

    // Build line
    const roleUpper = role.toUpperCase();
    let line = roleUpper;

    if (name) {
      line += ` "${truncateByType(name, 'ELEMENT_NAME')}"`;
    }

    // Generate ref for interactive elements
    const ref = `@ref:${refCounter++}`;
    refMap.set(ref, element);
    line += ` ${ref}`;
    capturedInteractive++;

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
          height: Math.round(bbox.height)
        },
        inViewport: win ? isInViewport(element, win) : undefined
      };
    } catch {
      refs[ref] = {
        selector: generateSimpleSelector(element),
        role: role.split(' ')[0],
        name: name || undefined
      };
    }

    // Add input attributes
    line += getInputAttributes(element);

    // Add state info
    const states: string[] = [];
    if (element.hasAttribute('disabled')) states.push('disabled');
    if ((element as HTMLInputElement).checked) states.push('checked');
    if (element.getAttribute('aria-expanded') === 'true') states.push('expanded');
    if (element.getAttribute('aria-selected') === 'true') states.push('selected');

    if (states.length) line += ` (${states.join(', ')})`;

    // Add semantic xpath
    const xpath = buildSemanticXPath(element);
    line += ` ${xpath}`;

    lines.push(line);
  }

  // Build page header
  const pageInfo = getPageInfo(document);
  const pageHeader = buildPageHeader(pageInfo);

  // Apply grep filter if specified
  let filteredLines = lines;
  let grepInfo: { pattern: string; matchCount: number } | undefined;

  if (grepPattern) {
    const grepResult = grepLines(lines, grepPattern);
    filteredLines = grepResult.items;
    grepInfo = {
      pattern: grepResult.pattern,
      matchCount: grepResult.matchCount,
    };
  }

  // Build snapshot header
  let snapshotHeader = `SNAPSHOT: elements=${elements.length} refs=${capturedInteractive}`;
  if (grepInfo) {
    snapshotHeader += ` grep=${grepInfo.pattern} matches=${grepInfo.matchCount}`;
  }

  const output = buildSnapshotOutput(pageHeader, snapshotHeader, filteredLines);

  // Detect problematic page states
  const warnings: string[] = [];
  const viewportArea = pageInfo.viewportWidth * pageInfo.viewportHeight;

  if (viewportArea === 0) {
    warnings.push('Viewport not initialized (0x0) - page may be loading or redirecting');
  }

  if (capturedInteractive === 0 && totalInteractive === 0 && elements.length < 10) {
    warnings.push('Page appears to be empty or transitional - wait for content to load');
  }

  const url = document.location?.href || '';
  if (url.includes('RotateCookies') ||
      url.includes('ServiceLogin') ||
      url.includes('/blank')) {
    warnings.push('Detected intermediate/redirect page - snapshot may not contain meaningful content');
  }

  return {
    tree: output,
    refs,
    metadata: {
      totalInteractiveElements: totalInteractive,
      capturedElements: capturedInteractive,
      quality: viewportArea === 0 || capturedInteractive === 0 ? 'low' : capturedInteractive < totalInteractive * 0.5 ? 'medium' : 'high',
      warnings: warnings.length > 0 ? warnings : undefined
    }
  };
}
