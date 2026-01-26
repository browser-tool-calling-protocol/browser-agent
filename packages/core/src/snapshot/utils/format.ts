/**
 * @btcp/core - Snapshot Format Utilities
 *
 * Output formatting utilities for snapshot generation.
 */

import { countWords, countChildElements, detectCodeLanguage } from './filter.js';

// ============================================================================
// Truncation Limits
// ============================================================================

export const TRUNCATE_LIMITS = {
  ELEMENT_NAME: 50,
  TEXT_SHORT: 80,
  TEXT_LONG: 120,
  ERROR_MESSAGE: 100,
  URL: 150,
} as const;

/**
 * Truncate string with context-aware limits
 */
export function truncateByType(str: string, type: keyof typeof TRUNCATE_LIMITS): string {
  const maxLength = TRUNCATE_LIMITS[type];
  const cleaned = str.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength - 3) + '...';
}

/**
 * Truncate string to a specific length
 */
export function truncate(str: string, maxLength: number): string {
  const cleaned = str.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength - 3) + '...';
}

// ============================================================================
// Page Header Generation
// ============================================================================

export interface PageInfo {
  url: string;
  title: string;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * Build page header line
 */
export function buildPageHeader(info: PageInfo): string {
  const url = truncateByType(info.url || 'about:blank', 'URL');
  const title = truncateByType(info.title || 'Untitled', 'TEXT_SHORT');
  return `PAGE: ${url} | ${title} | viewport=${info.viewportWidth}x${info.viewportHeight}`;
}

/**
 * Get page info from document
 */
export function getPageInfo(document: Document): PageInfo {
  const win = document.defaultView || { innerWidth: 1024, innerHeight: 768 };
  return {
    url: document.location?.href || 'about:blank',
    title: document.title || 'Untitled',
    viewportWidth: win.innerWidth,
    viewportHeight: win.innerHeight,
  };
}

// ============================================================================
// Snapshot Header Generation
// ============================================================================

export interface SnapshotHeaderOptions {
  mode: string;
  elementCount: number;
  refCount?: number;
  maxLines?: number;
  truncated?: boolean;
  grep?: {
    pattern: string;
    matchCount: number;
  };
  extra?: Record<string, string | number>;
}

/**
 * Build snapshot header line
 */
export function buildSnapshotHeader(options: SnapshotHeaderOptions): string {
  const parts: string[] = [];

  parts.push(`${options.mode.toUpperCase()}:`);
  parts.push(`elements=${options.elementCount}`);

  if (options.refCount !== undefined) {
    parts.push(`refs=${options.refCount}`);
  }

  if (options.maxLines !== undefined) {
    parts.push(`maxLines=${options.maxLines}`);
  }

  if (options.truncated) {
    parts.push('(truncated)');
  }

  if (options.extra) {
    for (const [key, value] of Object.entries(options.extra)) {
      parts.push(`${key}=${value}`);
    }
  }

  if (options.grep) {
    parts.push(`grep=${options.grep.pattern}`);
    parts.push(`matches=${options.grep.matchCount}`);
  }

  return parts.join(' ');
}

// ============================================================================
// Element Line Generation
// ============================================================================

export interface ElementLineOptions {
  role: string;
  name?: string;
  ref?: string;
  xpath?: string;
  attributes?: string;
  states?: string[];
  indent?: string;
  metadata?: string;
}

/**
 * Build a formatted line for an element
 */
export function buildElementLine(options: ElementLineOptions): string {
  const parts: string[] = [];

  if (options.indent) {
    parts.push(options.indent);
  }

  parts.push(options.role.toUpperCase());

  if (options.name) {
    parts.push(`"${truncateByType(options.name, 'ELEMENT_NAME')}"`);
  }

  if (options.ref) {
    parts.push(options.ref);
  }

  if (options.metadata) {
    parts.push(options.metadata);
  }

  if (options.attributes) {
    parts.push(options.attributes);
  }

  if (options.states && options.states.length > 0) {
    parts.push(`(${options.states.join(', ')})`);
  }

  if (options.xpath) {
    parts.push(options.xpath);
  }

  return parts.join(' ');
}

// ============================================================================
// Outline Metadata Building
// ============================================================================

/**
 * Build metadata string for outline mode
 */
export function buildOutlineMetadata(element: Element): string {
  const parts: string[] = [];
  const wordCount = countWords(element.textContent || '');

  if (wordCount > 0) {
    parts.push(`${wordCount} words`);
  }

  // Count specific elements
  const links = element.querySelectorAll('a[href]').length;
  if (links > 0) parts.push(`${links} links`);

  const paragraphs = countChildElements(element, ['P']);
  if (paragraphs > 1) parts.push(`${paragraphs} paragraphs`);

  const listItems = countChildElements(element, ['LI']);
  if (listItems > 0) parts.push(`${listItems} items`);

  const codeBlocks = element.querySelectorAll('pre, code').length;
  if (codeBlocks > 0) parts.push(`${codeBlocks} code`);

  return parts.length > 0 ? `[${parts.join(', ')}]` : '';
}

/**
 * Build interaction summary for structure mode
 */
export function buildInteractionSummary(counts: {
  buttons: number;
  links: number;
  inputs: number;
  other: number;
}): string {
  const parts: string[] = [];
  const total = counts.buttons + counts.links + counts.inputs + counts.other;

  if (total === 0) return '';

  if (counts.buttons > 0) parts.push(`${counts.buttons} button${counts.buttons > 1 ? 's' : ''}`);
  if (counts.links > 0) parts.push(`${counts.links} link${counts.links > 1 ? 's' : ''}`);
  if (counts.inputs > 0) parts.push(`${counts.inputs} input${counts.inputs > 1 ? 's' : ''}`);
  if (counts.other > 0) parts.push(`${counts.other} other`);

  return `[${parts.join(', ')}]`;
}

// ============================================================================
// Content Formatting
// ============================================================================

/**
 * Build a content section header
 */
export function buildContentSectionHeader(xpath: string, wordCount: number): string {
  return `SECTION ${xpath} [${wordCount} words]`;
}

/**
 * Build code block output
 */
export function buildCodeBlockOutput(element: Element, indent: string = ''): string[] {
  const lines: string[] = [];
  const lang = detectCodeLanguage(element);
  const code = (element.textContent || '').trim();
  const codeLines = code.split('\n');
  const preview = codeLines.slice(0, 5).join('\n');

  let header = `${indent}CODE`;
  if (lang) header += ` [${lang}, ${codeLines.length} lines]`;
  else header += ` [${codeLines.length} lines]`;
  lines.push(header);

  // Add preview of code
  for (const codeLine of preview.split('\n')) {
    lines.push(`${indent}  ${codeLine}`);
  }
  if (codeLines.length > 5) {
    lines.push(`${indent}  ...`);
  }

  return lines;
}

/**
 * Build list output for content mode
 */
export function buildListOutput(items: string[], indent: string = ''): string[] {
  const lines: string[] = [];
  lines.push(`${indent}LIST [${items.length} items]`);
  for (const item of items) {
    lines.push(`${indent}  - "${item}"`);
  }
  return lines;
}

// ============================================================================
// Markdown Formatting
// ============================================================================

/**
 * Build markdown heading
 */
export function buildMarkdownHeading(level: number, text: string): string {
  const prefix = '#'.repeat(Math.min(Math.max(level, 1), 6));
  return `${prefix} ${text}`;
}

/**
 * Build markdown list item
 */
export function buildMarkdownListItem(text: string, ordered: boolean = false, index?: number): string {
  if (ordered && index !== undefined) {
    return `${index}. ${text}`;
  }
  return `- ${text}`;
}

/**
 * Build markdown code block
 */
export function buildMarkdownCodeBlock(code: string, language?: string): string[] {
  const lines: string[] = [];
  lines.push('```' + (language || ''));
  lines.push(code);
  lines.push('```');
  return lines;
}

/**
 * Build markdown blockquote
 */
export function buildMarkdownBlockquote(text: string): string[] {
  return text.split('\n').map(l => `> ${l}`);
}

/**
 * Build markdown image
 */
export function buildMarkdownImage(alt: string, src: string): string {
  return `![${alt}](${src})`;
}

// ============================================================================
// Output Assembly
// ============================================================================

/**
 * Join output sections with proper spacing
 */
export function joinOutputSections(...sections: (string | string[])[]): string {
  const allLines: string[] = [];

  for (const section of sections) {
    if (Array.isArray(section)) {
      allLines.push(...section);
    } else {
      allLines.push(section);
    }
  }

  return allLines.join('\n');
}

/**
 * Build full snapshot output
 */
export function buildSnapshotOutput(
  pageHeader: string,
  snapshotHeader: string,
  lines: string[]
): string {
  return [pageHeader, snapshotHeader, '', ...lines].join('\n');
}
