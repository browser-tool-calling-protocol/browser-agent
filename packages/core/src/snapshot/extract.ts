/**
 * @btcp/core - Content Extraction
 *
 * Extract content as HTML or Markdown.
 * Unix philosophy: Separate extraction (content transformation) from snapshot (DOM state capture).
 */

import { validateRoot } from './types.js';
import {
  getRole,
  isVisible,
} from './utils/inspect.js';
import {
  getCleanTextContent,
  detectCodeLanguage,
} from './utils/filter.js';
import {
  buildMarkdownHeading,
  buildMarkdownListItem,
  buildMarkdownCodeBlock,
  buildMarkdownBlockquote,
  buildMarkdownImage,
} from './utils/format.js';

/**
 * Options for extract()
 */
export interface ExtractOptions {
  /** Root element to start extraction from (default: document.body) */
  root?: Element;
  /** Maximum depth to traverse (default: 50) */
  maxDepth?: number;
  /** Include hidden elements (default: false) */
  includeHidden?: boolean;
  /** Output format: 'html' or 'markdown' (default: 'markdown') */
  format?: 'html' | 'markdown';
  /** CSS selector to extract from */
  selector?: string;
  /** Maximum content length (default: unlimited) */
  maxLength?: number;
  /** Include links as [text](url) - markdown only (default: true) */
  includeLinks?: boolean;
  /** Include images as ![alt](src) (default: false) */
  includeImages?: boolean;
}

/**
 * Extract content as HTML or Markdown
 *
 * Returns content string directly (not SnapshotData).
 * Use this when you want the actual content transformed to a target format.
 *
 * @param document - The document to extract from
 * @param options - Extraction options
 * @returns Content string in the specified format
 *
 * @example Markdown extraction (default)
 * ```typescript
 * const markdown = extract(document, { selector: 'article' });
 * // Returns: "# Article Title\n\nFirst paragraph..."
 * ```
 *
 * @example HTML extraction
 * ```typescript
 * const html = extract(document, { format: 'html', selector: 'main' });
 * // Returns: "<main><h1>Title</h1><p>Content</p></main>"
 * ```
 */
export function extract(
  document: Document,
  options: ExtractOptions = {}
): string {
  const {
    maxDepth = 50,
    includeHidden = false,
    format = 'markdown',
    selector,
    maxLength,
    includeLinks = true,
    includeImages = false,
  } = options;

  // Determine root element
  let root: Element;
  if (selector) {
    const selected = document.querySelector(selector);
    if (!selected) {
      return format === 'html' ? '' : '';
    }
    root = selected;
  } else if (options.root) {
    root = validateRoot(options.root, document);
  } else {
    root = validateRoot(undefined, document);
  }

  // Extract based on format
  if (format === 'html') {
    return extractHtml(root, { maxLength, includeHidden, maxDepth });
  }

  return extractMarkdown(root, { maxLength, includeLinks, includeImages, includeHidden, maxDepth });
}

/**
 * Extract content as HTML
 */
function extractHtml(
  root: Element,
  options: { maxLength?: number; includeHidden: boolean; maxDepth: number }
): string {
  const { maxLength } = options;

  // For HTML, we return the outerHTML of the element
  let html = root.outerHTML;

  // Apply maxLength if specified
  if (maxLength && html.length > maxLength) {
    html = html.slice(0, maxLength) + '<!-- truncated -->';
  }

  return html;
}

/**
 * Extract content as Markdown
 */
function extractMarkdown(
  root: Element,
  options: {
    maxLength?: number;
    includeLinks: boolean;
    includeImages: boolean;
    includeHidden: boolean;
    maxDepth: number;
  }
): string {
  const { maxLength, includeLinks, includeImages, includeHidden, maxDepth } = options;
  const lines: string[] = [];

  // Add source comment
  const doc = root.ownerDocument;
  lines.push(`<!-- source: ${doc.location?.href || 'about:blank'} -->`);
  lines.push('');

  // Extract content recursively
  extractMarkdownContent(root, lines, includeLinks, includeImages, includeHidden, maxDepth, 0);

  let output = lines.join('\n');

  // Apply maxLength if specified
  if (maxLength && output.length > maxLength) {
    output = output.slice(0, maxLength) + '\n\n<!-- truncated -->';
  }

  return output;
}

/**
 * Extract markdown content from element (recursive)
 */
function extractMarkdownContent(
  element: Element,
  lines: string[],
  includeLinks: boolean,
  includeImages: boolean,
  includeHidden: boolean,
  maxDepth: number,
  depth: number
): void {
  if (depth > maxDepth) return;
  if (!includeHidden && !isVisible(element, false)) return;

  const tagName = element.tagName;
  const role = getRole(element);

  // Headings
  if (role?.startsWith('heading')) {
    const level = parseInt(tagName[1]);
    const text = getCleanTextContent(element, 100);
    lines.push(buildMarkdownHeading(level, text));
    lines.push('');
    return;
  }

  // Paragraphs
  if (tagName === 'P') {
    const text = extractTextWithLinks(element, includeLinks);
    if (text) {
      lines.push(text);
      lines.push('');
    }
    return;
  }

  // Unordered lists
  if (tagName === 'UL') {
    const items = element.querySelectorAll(':scope > li');
    for (const item of items) {
      const text = extractTextWithLinks(item as Element, includeLinks, 200);
      if (text) lines.push(buildMarkdownListItem(text));
    }
    lines.push('');
    return;
  }

  // Ordered lists
  if (tagName === 'OL') {
    const items = element.querySelectorAll(':scope > li');
    let i = 1;
    for (const item of items) {
      const text = extractTextWithLinks(item as Element, includeLinks, 200);
      if (text) lines.push(buildMarkdownListItem(text, true, i));
      i++;
    }
    lines.push('');
    return;
  }

  // Code blocks
  if (tagName === 'PRE') {
    const lang = detectCodeLanguage(element) || '';
    const code = (element.textContent || '').trim();
    const codeLines = buildMarkdownCodeBlock(code, lang);
    lines.push(...codeLines);
    lines.push('');
    return;
  }

  // Inline code
  if (tagName === 'CODE' && element.parentElement?.tagName !== 'PRE') {
    // Skip - will be handled by parent text extraction
    return;
  }

  // Blockquotes
  if (tagName === 'BLOCKQUOTE') {
    const text = getCleanTextContent(element, 2000);
    if (text) {
      const quotedLines = buildMarkdownBlockquote(text);
      lines.push(...quotedLines);
      lines.push('');
    }
    return;
  }

  // Images (if requested)
  if (includeImages && tagName === 'IMG') {
    const alt = element.getAttribute('alt') || 'image';
    const src = element.getAttribute('src') || '';
    lines.push(buildMarkdownImage(alt, src));
    lines.push('');
    return;
  }

  // Links at block level (if it's a standalone link)
  if (tagName === 'A' && includeLinks) {
    const href = element.getAttribute('href');
    const text = getCleanTextContent(element, 100);
    if (href && text) {
      lines.push(`[${text}](${href})`);
      lines.push('');
    }
    return;
  }

  // Horizontal rules
  if (tagName === 'HR') {
    lines.push('---');
    lines.push('');
    return;
  }

  // Tables
  if (tagName === 'TABLE') {
    extractMarkdownTable(element, lines);
    return;
  }

  // Recurse into other elements
  for (const child of element.children) {
    extractMarkdownContent(child, lines, includeLinks, includeImages, includeHidden, maxDepth, depth + 1);
  }
}

/**
 * Extract text with inline links converted to markdown
 */
function extractTextWithLinks(element: Element, includeLinks: boolean, maxLength: number = 2000): string {
  if (!includeLinks) {
    return getCleanTextContent(element, maxLength);
  }

  // Build text with links converted to markdown format
  let result = '';
  const walker = element.ownerDocument.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          return NodeFilter.FILTER_ACCEPT;
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          if (el.tagName === 'A') {
            return NodeFilter.FILTER_ACCEPT;
          }
          if (el.tagName === 'CODE') {
            return NodeFilter.FILTER_ACCEPT;
          }
          if (el.tagName === 'STRONG' || el.tagName === 'B') {
            return NodeFilter.FILTER_ACCEPT;
          }
          if (el.tagName === 'EM' || el.tagName === 'I') {
            return NodeFilter.FILTER_ACCEPT;
          }
        }
        return NodeFilter.FILTER_SKIP;
      }
    }
  );

  const processedElements = new Set<Element>();

  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Check if this text node is inside an element we've already processed
      const parentEl = node.parentElement;
      if (parentEl && processedElements.has(parentEl)) {
        continue;
      }
      result += node.textContent || '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (el.tagName === 'A') {
        const href = el.getAttribute('href');
        const text = el.textContent?.trim() || '';
        if (href && text) {
          result += `[${text}](${href})`;
        } else {
          result += text;
        }
        processedElements.add(el);
      } else if (el.tagName === 'CODE') {
        const text = el.textContent || '';
        result += `\`${text}\``;
        processedElements.add(el);
      } else if (el.tagName === 'STRONG' || el.tagName === 'B') {
        const text = el.textContent || '';
        result += `**${text}**`;
        processedElements.add(el);
      } else if (el.tagName === 'EM' || el.tagName === 'I') {
        const text = el.textContent || '';
        result += `*${text}*`;
        processedElements.add(el);
      }
    }
  }

  // Clean up whitespace
  result = result.replace(/\s+/g, ' ').trim();

  // Apply max length
  if (result.length > maxLength) {
    result = result.slice(0, maxLength - 3) + '...';
  }

  return result;
}

/**
 * Extract table as markdown
 */
function extractMarkdownTable(table: Element, lines: string[]): void {
  const rows = table.querySelectorAll('tr');
  if (rows.length === 0) return;

  const tableRows: string[][] = [];
  let maxCols = 0;

  for (const row of rows) {
    const cells = row.querySelectorAll('th, td');
    const rowData: string[] = [];
    for (const cell of cells) {
      rowData.push(getCleanTextContent(cell as Element, 100));
    }
    tableRows.push(rowData);
    maxCols = Math.max(maxCols, rowData.length);
  }

  if (tableRows.length === 0 || maxCols === 0) return;

  // Normalize rows to have same number of columns
  for (const row of tableRows) {
    while (row.length < maxCols) {
      row.push('');
    }
  }

  // Build markdown table
  // Header row
  lines.push('| ' + tableRows[0].join(' | ') + ' |');
  // Separator
  lines.push('| ' + tableRows[0].map(() => '---').join(' | ') + ' |');
  // Data rows
  for (let i = 1; i < tableRows.length; i++) {
    lines.push('| ' + tableRows[i].join(' | ') + ' |');
  }
  lines.push('');
}
