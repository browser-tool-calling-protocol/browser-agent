/**
 * @btcp/core - Snapshot Filter Utilities
 *
 * Filtering utilities including grep pattern matching and element visibility.
 * Single implementation replacing 4 duplicated copies (~200 lines saved).
 */

import { isVisible as checkElementVisibility } from './inspect.js';

// ============================================================================
// Grep Types
// ============================================================================

/**
 * Grep options (mirrors Unix grep flags)
 */
export interface GrepOptions {
  /** Pattern to search for */
  pattern: string;
  /** Case-insensitive matching (grep -i) */
  ignoreCase?: boolean;
  /** Invert match - return non-matching lines (grep -v) */
  invert?: boolean;
  /** Treat pattern as fixed string, not regex (grep -F) */
  fixedStrings?: boolean;
}

/**
 * Grep result with metadata
 */
export interface GrepResult<T> {
  /** Filtered items */
  items: T[];
  /** Pattern used for filtering */
  pattern: string;
  /** Number of matches */
  matchCount: number;
  /** Total items before filtering */
  totalCount: number;
}

// ============================================================================
// Grep Implementation (Single Copy)
// ============================================================================

/**
 * Apply grep filter to lines
 *
 * This is the single implementation of grep filtering,
 * replacing the 4 duplicated implementations in the original snapshot.ts
 *
 * @param lines - Array of strings to filter
 * @param grepPattern - String pattern or GrepOptions object
 * @returns Grep result with filtered lines and metadata
 */
export function grepLines(lines: string[], grepPattern: string | GrepOptions): GrepResult<string> {
  const grepOpts = typeof grepPattern === 'string'
    ? { pattern: grepPattern }
    : grepPattern;

  const { pattern, ignoreCase = false, invert = false, fixedStrings = false } = grepOpts;

  // Build regex from pattern
  let regexPattern = fixedStrings
    ? pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')  // Escape regex chars
    : pattern;

  const flags = ignoreCase ? 'i' : '';

  let filteredLines: string[];

  try {
    const regex = new RegExp(regexPattern, flags);
    filteredLines = lines.filter(line => {
      const matches = regex.test(line);
      return invert ? !matches : matches;
    });
  } catch {
    // Invalid regex, fall back to string matching
    filteredLines = lines.filter(line => {
      const matches = ignoreCase
        ? line.toLowerCase().includes(pattern.toLowerCase())
        : line.includes(pattern);
      return invert ? !matches : matches;
    });
  }

  return {
    items: filteredLines,
    pattern,
    matchCount: filteredLines.length,
    totalCount: lines.length,
  };
}

/**
 * Apply grep filter to an array of objects by extracting a string field
 *
 * @param items - Array of objects to filter
 * @param grepPattern - String pattern or GrepOptions object
 * @param extractor - Function to extract the string to match against
 * @returns Grep result with filtered items and metadata
 */
export function grepItems<T>(
  items: T[],
  grepPattern: string | GrepOptions,
  extractor: (item: T) => string
): GrepResult<T> {
  const grepOpts = typeof grepPattern === 'string'
    ? { pattern: grepPattern }
    : grepPattern;

  const { pattern, ignoreCase = false, invert = false, fixedStrings = false } = grepOpts;

  // Build regex from pattern
  let regexPattern = fixedStrings
    ? pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    : pattern;

  const flags = ignoreCase ? 'i' : '';

  let filteredItems: T[];

  try {
    const regex = new RegExp(regexPattern, flags);
    filteredItems = items.filter(item => {
      const text = extractor(item);
      const matches = regex.test(text);
      return invert ? !matches : matches;
    });
  } catch {
    // Invalid regex, fall back to string matching
    filteredItems = items.filter(item => {
      const text = extractor(item);
      const matches = ignoreCase
        ? text.toLowerCase().includes(pattern.toLowerCase())
        : text.includes(pattern);
      return invert ? !matches : matches;
    });
  }

  return {
    items: filteredItems,
    pattern,
    matchCount: filteredItems.length,
    totalCount: items.length,
  };
}

/**
 * Check if a string matches a grep pattern
 *
 * @param text - Text to check
 * @param grepPattern - String pattern or GrepOptions object
 * @returns True if text matches the pattern
 */
export function matchesGrep(text: string, grepPattern: string | GrepOptions): boolean {
  const grepOpts = typeof grepPattern === 'string'
    ? { pattern: grepPattern }
    : grepPattern;

  const { pattern, ignoreCase = false, invert = false, fixedStrings = false } = grepOpts;

  // Build regex from pattern
  let regexPattern = fixedStrings
    ? pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    : pattern;

  const flags = ignoreCase ? 'i' : '';

  try {
    const regex = new RegExp(regexPattern, flags);
    const matches = regex.test(text);
    return invert ? !matches : matches;
  } catch {
    // Invalid regex, fall back to string matching
    const matches = ignoreCase
      ? text.toLowerCase().includes(pattern.toLowerCase())
      : text.includes(pattern);
    return invert ? !matches : matches;
  }
}

// ============================================================================
// Visibility Filtering
// ============================================================================

/**
 * Filter elements by visibility
 *
 * @param elements - Array of elements to filter
 * @param includeHidden - If true, include hidden elements
 * @param checkAncestors - If true, check ancestor visibility too
 * @returns Filtered array of visible elements
 */
export function filterVisible(
  elements: Element[],
  includeHidden: boolean = false,
  checkAncestors: boolean = false
): Element[] {
  if (includeHidden) {
    return elements;
  }

  return elements.filter(el => checkElementVisibility(el, checkAncestors));
}

/**
 * Filter elements by a predicate function
 *
 * @param elements - Array of elements to filter
 * @param predicate - Function that returns true for elements to include
 * @returns Filtered array of elements
 */
export function filterElements(
  elements: Element[],
  predicate: (element: Element) => boolean
): Element[] {
  return elements.filter(predicate);
}

// ============================================================================
// Content Filtering
// ============================================================================

/**
 * Count words in text content
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Get full text content with whitespace normalization
 */
export function getCleanTextContent(element: Element, maxLength?: number): string {
  const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
  if (maxLength && text.length > maxLength) {
    return text.slice(0, maxLength - 3) + '...';
  }
  return text;
}

/**
 * Count specific child elements by tag name
 */
export function countChildElements(element: Element, tagNames: string[]): number {
  const tags = new Set(tagNames.map(t => t.toUpperCase()));
  let count = 0;
  const walk = (el: Element) => {
    if (tags.has(el.tagName)) count++;
    for (const child of el.children) walk(child);
  };
  walk(element);
  return count;
}

/**
 * Get list items as strings
 */
export function getListItems(element: Element, maxItems: number = 10): string[] {
  const items: string[] = [];
  const listItems = element.querySelectorAll('li');
  for (let i = 0; i < Math.min(listItems.length, maxItems); i++) {
    const text = getCleanTextContent(listItems[i], 100);
    if (text) items.push(text);
  }
  return items;
}

/**
 * Detect code language from class or content
 */
export function detectCodeLanguage(element: Element): string | null {
  // Check class names for language hints
  const classes = element.className?.toString() || '';
  const match = classes.match(/(?:language-|lang-)(\w+)/i);
  if (match) return match[1].toLowerCase();

  // Check parent pre/code element
  const parent = element.closest('pre, code');
  if (parent && parent !== element) {
    const parentClasses = parent.className?.toString() || '';
    const parentMatch = parentClasses.match(/(?:language-|lang-)(\w+)/i);
    if (parentMatch) return parentMatch[1].toLowerCase();
  }

  return null;
}
