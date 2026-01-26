/**
 * @btcp/core - snapshotContent
 *
 * Extract text content from sections.
 * Returns tree format (structure) - use extract() for markdown/HTML output.
 *
 * Unix philosophy: Do one thing well - capture content structure as tree.
 */

import type { ContentOptions, SnapshotData, RefMap } from './types.js';
import { validateRoot } from './types.js';
import {
  getRole,
  isVisible,
  getSemanticClass,
  buildSemanticXPath,
  LANDMARK_ROLES,
} from './utils/inspect.js';
import {
  grepElements,
  buildElementSearchData,
  countWords,
  getCleanTextContent,
  getListItems,
  type ElementSearchData,
} from './utils/filter.js';
import {
  buildPageHeader,
  getPageInfo,
  buildContentSectionHeader,
  buildCodeBlockOutput,
  buildListOutput,
} from './utils/format.js';

/**
 * Content section for processing with search data
 */
interface ContentSection {
  xpath: string;
  element: Element;
  heading?: string;
  headingLevel?: number;
  searchData: ElementSearchData;
}

/**
 * Create a content snapshot extracting text from sections
 *
 * Extracts text content from landmarks, articles, and named sections.
 * Always returns tree format (use extract() for markdown/HTML).
 *
 * @param document - The document to snapshot
 * @param refMap - Reference map (optional, refs generated for sections)
 * @param options - Optional configuration
 * @returns SnapshotData with extracted content
 *
 * @example
 * ```typescript
 * const snapshot = snapshotContent(document, refMap);
 * // SECTION /main#content [500 words]
 * //   HEADING level=1 "Welcome"
 * //   TEXT "This is the introduction..."
 * //   LIST [3 items]
 * //     - "First item"
 * //     - "Second item"
 * ```
 */
export function snapshotContent(
  document: Document,
  refMap: RefMap,
  options: ContentOptions = {}
): SnapshotData {
  const root = validateRoot(options.root, document);

  const {
    maxDepth = 50,
    includeHidden = false,
    grep: grepPattern,
    maxLength = 2000,
  } = options;

  refMap.clear();
  const refs: SnapshotData['refs'] = {};

  // Collect content sections with search data
  const sections: ContentSection[] = [];

  function collectSections(element: Element, depth: number): void {
    if (depth > maxDepth) return;
    if (!includeHidden && !isVisible(element, false)) return;

    const xpath = buildSemanticXPath(element);
    const role = getRole(element);
    const tagName = element.tagName;

    // Check if this element should be a section
    let isSection = false;

    // Landmarks and articles are sections
    if (role && (LANDMARK_ROLES.has(role) || role === 'article')) {
      isSection = true;
    }
    // Named sections/regions
    else if (tagName === 'SECTION' && (element.id || element.getAttribute('aria-label'))) {
      isSection = true;
    }
    // Semantic divs with substantial content
    else if (tagName === 'DIV' && (element.id || getSemanticClass(element))) {
      const wordCount = countWords(element.textContent || '');
      if (wordCount > 30) isSection = true;
    }

    if (isSection) {
      // Get first heading in section
      const heading = element.querySelector('h1, h2, h3, h4, h5, h6');
      const headingText = heading ? getCleanTextContent(heading, 100) : undefined;

      // Build rich search data for element-level grep
      const searchData = buildElementSearchData(element, role || 'section', headingText, xpath);

      sections.push({
        xpath,
        element,
        heading: headingText,
        headingLevel: heading ? parseInt(heading.tagName[1]) : undefined,
        searchData,
      });
    }

    // Recurse into children
    for (const child of element.children) {
      collectSections(child, depth + 1);
    }
  }

  collectSections(root, 0);

  // Filter sections by grep pattern at ELEMENT level (matches full content)
  let filteredSections = sections;
  let grepInfo: { pattern: string; matchCount: number; totalCount: number } | undefined;

  if (grepPattern) {
    const searchDataList = sections.map(s => s.searchData);
    const grepResult = grepElements(searchDataList, grepPattern);

    // Map back to sections
    const matchedSet = new Set(grepResult.items.map(d => d.element));
    filteredSections = sections.filter(s => matchedSet.has(s.element));

    grepInfo = {
      pattern: grepResult.pattern,
      matchCount: grepResult.matchCount,
      totalCount: grepResult.totalCount,
    };
  }

  // Tree format output
  const lines: string[] = [];
  let totalWords = 0;

  for (const section of filteredSections) {
    const sectionWords = countWords(section.element.textContent || '');
    totalWords += sectionWords;

    lines.push(buildContentSectionHeader(section.xpath, sectionWords));

    // Extract content from section
    extractContentLines(section.element, lines, '  ', maxLength);
    lines.push('');
  }

  // Build headers
  const pageInfo = getPageInfo(document);
  const pageHeader = buildPageHeader(pageInfo);

  let contentHeader = `CONTENT: sections=${filteredSections.length} words=${totalWords}`;
  if (grepInfo) {
    contentHeader += ` grep=${grepInfo.pattern} matches=${grepInfo.matchCount}`;
  }

  const output = [pageHeader, contentHeader, '', ...lines].join('\n');

  return {
    tree: output,
    refs,
    metadata: {
      totalInteractiveElements: filteredSections.length,
      capturedElements: Object.keys(refs).length,
      quality: 'high'
    }
  };
}

/**
 * Extract content lines from an element (for tree format)
 */
function extractContentLines(
  element: Element,
  lines: string[],
  indent: string,
  maxLength: number
): void {
  const tagName = element.tagName;
  const role = getRole(element);

  // Headings
  if (role?.startsWith('heading')) {
    const level = tagName[1];
    const text = getCleanTextContent(element, 100);
    lines.push(`${indent}HEADING level=${level} "${text}"`);
    return;
  }

  // Paragraphs
  if (tagName === 'P') {
    const text = getCleanTextContent(element, maxLength);
    if (text) {
      lines.push(`${indent}TEXT "${text}"`);
    }
    return;
  }

  // Lists
  if (tagName === 'UL' || tagName === 'OL') {
    const items = getListItems(element, 10);
    if (items.length > 0) {
      const listLines = buildListOutput(items, indent);
      lines.push(...listLines);
    }
    return;
  }

  // Code blocks
  if (tagName === 'PRE') {
    const codeLines = buildCodeBlockOutput(element, indent);
    lines.push(...codeLines);
    return;
  }

  // Recurse into other elements
  for (const child of element.children) {
    extractContentLines(child, lines, indent, maxLength);
  }
}
