/**
 * @btcp/core - snapshotOutline
 *
 * Structural overview with metadata (landmarks, sections, headings).
 * Provides refs for major page sections.
 *
 * Unix philosophy: Do one thing well - understand page outline.
 */

import type { OutlineOptions, SnapshotData, RefMap } from './types.js';
import { validateRoot } from './types.js';
import {
  getRole,
  isVisible,
  getSemanticClass,
  getSectionName,
  buildSemanticXPath,
  generateSelector,
  LANDMARK_ROLES,
} from './utils/inspect.js';
import { grepLines, countWords, getCleanTextContent, detectCodeLanguage } from './utils/filter.js';
import { truncateByType, buildPageHeader, getPageInfo, buildOutlineMetadata } from './utils/format.js';

/**
 * Create an outline snapshot of the page structure
 *
 * Returns landmarks, sections, headings, and major content blocks with
 * metadata (word counts, link counts, etc.). Provides refs for major sections.
 *
 * @param document - The document to snapshot
 * @param refMap - Reference map to store section refs
 * @param options - Optional configuration
 * @returns SnapshotData with page outline and refs
 *
 * @example
 * ```typescript
 * const refMap = createRefMap();
 * const snapshot = snapshotOutline(document, refMap);
 *
 * // Output shows page structure:
 * // MAIN "content" @ref:0 [500 words, 10 links] /main#content
 * //   HEADING level=1 "Welcome" /main/h1
 * //   ARTICLE "blog post" @ref:1 [200 words] /main/article
 * ```
 */
export function snapshotOutline(
  document: Document,
  refMap: RefMap,
  options: OutlineOptions = {}
): SnapshotData {
  const root = validateRoot(options.root, document);
  const { maxDepth = 50, includeHidden = false, grep: grepPattern } = options;

  refMap.clear();
  const refs: SnapshotData['refs'] = {};
  const lines: string[] = [];
  let refCounter = 0;

  // Stats for header
  let landmarkCount = 0;
  let sectionCount = 0;
  let headingCount = 0;

  // Recursive function to build outline with indentation
  function buildOutline(element: Element, depth: number, indent: number): void {
    if (depth > maxDepth) return;
    if (!includeHidden && !isVisible(element, false)) return;

    const role = getRole(element);
    const tagName = element.tagName;

    // Track stats
    if (role?.startsWith('heading')) headingCount++;
    if (LANDMARK_ROLES.has(role || '')) landmarkCount++;

    // Determine if this element should be in the outline
    let shouldInclude = false;
    let line = '';
    const indentStr = '  '.repeat(indent);

    // Landmarks (MAIN, BANNER, etc.)
    if (role && LANDMARK_ROLES.has(role)) {
      shouldInclude = true;
      const roleUpper = role.toUpperCase();
      const name = getSectionName(element);
      const metadata = buildOutlineMetadata(element);
      const xpath = buildSemanticXPath(element);

      // Generate ref for landmarks
      const ref = `@ref:${refCounter++}`;
      refMap.set(ref, element);
      refs[ref] = {
        selector: generateSelector(element),
        role: role,
        name: name || undefined
      };

      line = `${indentStr}${roleUpper}`;
      if (name) line += ` "${truncateByType(name, 'ELEMENT_NAME')}"`;
      line += ` ${ref}`;
      if (metadata) line += ` ${metadata}`;
      line += ` ${xpath}`;

      sectionCount++;
    }
    // Headings
    else if (role?.startsWith('heading')) {
      shouldInclude = true;
      const level = tagName[1];
      const text = getCleanTextContent(element, 60);
      const xpath = buildSemanticXPath(element);

      line = `${indentStr}HEADING level=${level}`;
      if (text) line += ` "${text}"`;
      line += ` ${xpath}`;
    }
    // Articles and named sections/regions
    else if (tagName === 'ARTICLE' || (tagName === 'SECTION' && (element.id || element.getAttribute('aria-label')))) {
      shouldInclude = true;
      const roleUpper = tagName === 'ARTICLE' ? 'ARTICLE' : 'REGION';
      const name = getSectionName(element);
      const metadata = buildOutlineMetadata(element);
      const xpath = buildSemanticXPath(element);

      // Generate ref
      const ref = `@ref:${refCounter++}`;
      refMap.set(ref, element);
      refs[ref] = {
        selector: generateSelector(element),
        role: roleUpper.toLowerCase(),
        name: name || undefined
      };

      line = `${indentStr}${roleUpper}`;
      if (name) line += ` "${truncateByType(name, 'ELEMENT_NAME')}"`;
      line += ` ${ref}`;
      if (metadata) line += ` ${metadata}`;
      line += ` ${xpath}`;

      sectionCount++;
    }
    // Divs with semantic id/class that contain substantial content
    else if (tagName === 'DIV' && (element.id || getSemanticClass(element))) {
      const wordCount = countWords(element.textContent || '');
      if (wordCount > 50) {
        shouldInclude = true;
        const name = getSectionName(element);
        const metadata = buildOutlineMetadata(element);
        const xpath = buildSemanticXPath(element);

        const ref = `@ref:${refCounter++}`;
        refMap.set(ref, element);
        refs[ref] = {
          selector: generateSelector(element),
          role: 'region',
          name: name || undefined
        };

        line = `${indentStr}REGION`;
        if (name) line += ` "${truncateByType(name, 'ELEMENT_NAME')}"`;
        line += ` ${ref}`;
        if (metadata) line += ` ${metadata}`;
        line += ` ${xpath}`;

        sectionCount++;
      }
    }
    // Lists
    else if (tagName === 'UL' || tagName === 'OL') {
      const items = element.querySelectorAll(':scope > li').length;
      if (items > 0) {
        shouldInclude = true;
        const xpath = buildSemanticXPath(element);
        line = `${indentStr}LIST [${items} items] ${xpath}`;
      }
    }
    // Code blocks
    else if (tagName === 'PRE') {
      shouldInclude = true;
      const lang = detectCodeLanguage(element);
      const lineCount = (element.textContent || '').split('\n').length;
      const xpath = buildSemanticXPath(element);

      line = `${indentStr}CODE`;
      if (lang) line += ` [${lang}]`;
      line += ` [${lineCount} lines]`;
      line += ` ${xpath}`;
    }

    if (shouldInclude && line) {
      lines.push(line);
    }

    // Recurse into children (increase indent if we included this element)
    const nextIndent = shouldInclude ? indent + 1 : indent;
    for (const child of element.children) {
      buildOutline(child, depth + 1, nextIndent);
    }
  }

  buildOutline(root, 0, 0);

  // Calculate total words
  const totalWords = countWords(root.textContent || '');

  // Apply grep filter
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

  // Build headers
  const pageInfo = getPageInfo(document);
  const pageHeader = buildPageHeader(pageInfo);

  let outlineHeader = `OUTLINE: landmarks=${landmarkCount} sections=${sectionCount} headings=${headingCount} words=${totalWords}`;
  if (grepInfo) {
    outlineHeader += ` grep=${grepInfo.pattern} matches=${grepInfo.matchCount}`;
  }

  const output = [pageHeader, outlineHeader, '', ...filteredLines].join('\n');

  return {
    tree: output,
    refs,
    metadata: {
      totalInteractiveElements: sectionCount,
      capturedElements: refCounter,
      quality: 'high'
    }
  };
}
