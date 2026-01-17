/**
 * @btcp/grep
 *
 * Unix-like grep utility for searching text patterns.
 * Supports string and regex patterns with various options.
 *
 * @example
 * ```typescript
 * import { grep } from '@btcp/grep';
 *
 * const text = `line one
 * line two
 * another line`;
 *
 * // Basic search
 * const matches = grep('line', text);
 * // Returns: ['line one', 'line two', 'another line']
 *
 * // With line numbers
 * const withNumbers = grep('two', text, { lineNumbers: true });
 * // Returns: ['2:line two']
 * ```
 */

/**
 * Options for grep search
 */
export interface GrepOptions {
  /**
   * Case-insensitive matching
   * @default false
   */
  ignoreCase?: boolean;

  /**
   * Include line numbers in output (1-based)
   * @default false
   */
  lineNumbers?: boolean;

  /**
   * Invert match - return lines that do NOT match
   * @default false
   */
  invert?: boolean;

  /**
   * Only return count of matching lines
   * @default false
   */
  count?: boolean;

  /**
   * Match whole words only
   * @default false
   */
  wordMatch?: boolean;

  /**
   * Match whole lines only
   * @default false
   */
  lineMatch?: boolean;

  /**
   * Maximum number of matches to return (0 = unlimited)
   * @default 0
   */
  maxMatches?: number;

  /**
   * Number of context lines to include before each match
   * @default 0
   */
  before?: number;

  /**
   * Number of context lines to include after each match
   * @default 0
   */
  after?: number;
}

/**
 * Result of a grep search with detailed information
 */
export interface GrepMatch {
  /** The matched line content */
  line: string;
  /** 1-based line number */
  lineNumber: number;
  /** Whether this is a context line (not the actual match) */
  isContext?: boolean;
}

/**
 * Search for a pattern in text and return matched lines
 *
 * @param pattern - String or RegExp pattern to search for
 * @param text - Text to search in (can be multi-line)
 * @param options - Search options
 * @returns Array of matched lines, or count if options.count is true
 *
 * @example
 * ```typescript
 * // String pattern
 * grep('error', logText);
 *
 * // Regex pattern
 * grep(/error|warn/i, logText);
 *
 * // With options
 * grep('TODO', sourceCode, { ignoreCase: true, lineNumbers: true });
 * ```
 */
export function grep(
  pattern: string | RegExp,
  text: string,
  options: GrepOptions & { count: true }
): number;
export function grep(
  pattern: string | RegExp,
  text: string,
  options?: GrepOptions
): string[];
export function grep(
  pattern: string | RegExp,
  text: string,
  options: GrepOptions = {}
): string[] | number {
  const {
    ignoreCase = false,
    lineNumbers = false,
    invert = false,
    count = false,
    wordMatch = false,
    lineMatch = false,
    maxMatches = 0,
    before = 0,
    after = 0,
  } = options;

  const lines = text.split('\n');
  const regex = createRegex(pattern, { ignoreCase, wordMatch, lineMatch });

  const matchingIndices: number[] = [];

  // Find all matching line indices
  for (let i = 0; i < lines.length; i++) {
    const matches = regex.test(lines[i]);
    const shouldInclude = invert ? !matches : matches;

    if (shouldInclude) {
      matchingIndices.push(i);
      if (maxMatches > 0 && matchingIndices.length >= maxMatches) {
        break;
      }
    }
  }

  if (count) {
    return matchingIndices.length;
  }

  // Build result with context if needed
  const result: string[] = [];
  const includedIndices = new Set<number>();

  for (const matchIdx of matchingIndices) {
    // Add before context
    const startIdx = Math.max(0, matchIdx - before);
    // Add after context
    const endIdx = Math.min(lines.length - 1, matchIdx + after);

    for (let i = startIdx; i <= endIdx; i++) {
      if (!includedIndices.has(i)) {
        includedIndices.add(i);
        const line = lines[i];
        if (lineNumbers) {
          const prefix = i === matchIdx ? ':' : '-';
          result.push(`${i + 1}${prefix}${line}`);
        } else {
          result.push(line);
        }
      }
    }
  }

  // If we used context, we need to sort by line number
  if ((before > 0 || after > 0) && lineNumbers) {
    result.sort((a, b) => {
      const numA = parseInt(a.split(/[:-]/)[0], 10);
      const numB = parseInt(b.split(/[:-]/)[0], 10);
      return numA - numB;
    });
  }

  return result;
}

/**
 * Search for a pattern and return detailed match information
 *
 * @param pattern - String or RegExp pattern to search for
 * @param text - Text to search in
 * @param options - Search options (count option is ignored)
 * @returns Array of GrepMatch objects with line content and line numbers
 */
export function grepDetailed(
  pattern: string | RegExp,
  text: string,
  options: Omit<GrepOptions, 'count' | 'lineNumbers'> = {}
): GrepMatch[] {
  const {
    ignoreCase = false,
    invert = false,
    wordMatch = false,
    lineMatch = false,
    maxMatches = 0,
    before = 0,
    after = 0,
  } = options;

  const lines = text.split('\n');
  const regex = createRegex(pattern, { ignoreCase, wordMatch, lineMatch });

  const matchingIndices: number[] = [];

  // Find all matching line indices
  for (let i = 0; i < lines.length; i++) {
    const matches = regex.test(lines[i]);
    const shouldInclude = invert ? !matches : matches;

    if (shouldInclude) {
      matchingIndices.push(i);
      if (maxMatches > 0 && matchingIndices.length >= maxMatches) {
        break;
      }
    }
  }

  // Build result with context
  const result: GrepMatch[] = [];
  const includedIndices = new Set<number>();

  for (const matchIdx of matchingIndices) {
    const startIdx = Math.max(0, matchIdx - before);
    const endIdx = Math.min(lines.length - 1, matchIdx + after);

    for (let i = startIdx; i <= endIdx; i++) {
      if (!includedIndices.has(i)) {
        includedIndices.add(i);
        result.push({
          line: lines[i],
          lineNumber: i + 1,
          isContext: i !== matchIdx,
        });
      }
    }
  }

  // Sort by line number if context was included
  if (before > 0 || after > 0) {
    result.sort((a, b) => a.lineNumber - b.lineNumber);
  }

  return result;
}

/**
 * Search for a pattern in an array of lines
 *
 * @param pattern - String or RegExp pattern to search for
 * @param lines - Array of lines to search
 * @param options - Search options
 * @returns Array of matched lines or count
 */
export function grepLines(
  pattern: string | RegExp,
  lines: string[],
  options: GrepOptions & { count: true }
): number;
export function grepLines(
  pattern: string | RegExp,
  lines: string[],
  options?: GrepOptions
): string[];
export function grepLines(
  pattern: string | RegExp,
  lines: string[],
  options: GrepOptions = {}
): string[] | number {
  return grep(pattern, lines.join('\n'), options);
}

/**
 * Check if a pattern exists in text (like grep -q)
 *
 * @param pattern - String or RegExp pattern to search for
 * @param text - Text to search in
 * @param options - Search options (only ignoreCase, wordMatch, lineMatch are used)
 * @returns true if pattern is found, false otherwise
 */
export function grepTest(
  pattern: string | RegExp,
  text: string,
  options: Pick<GrepOptions, 'ignoreCase' | 'wordMatch' | 'lineMatch'> = {}
): boolean {
  const { ignoreCase = false, wordMatch = false, lineMatch = false } = options;
  const regex = createRegex(pattern, { ignoreCase, wordMatch, lineMatch });

  const lines = text.split('\n');
  return lines.some((line) => regex.test(line));
}

/**
 * Create a regex from a string or RegExp pattern with the given options
 */
function createRegex(
  pattern: string | RegExp,
  options: { ignoreCase: boolean; wordMatch: boolean; lineMatch: boolean }
): RegExp {
  const { ignoreCase, wordMatch, lineMatch } = options;

  if (pattern instanceof RegExp) {
    // If it's already a RegExp, we need to potentially modify its flags
    let flags = pattern.flags;
    if (ignoreCase && !flags.includes('i')) {
      flags += 'i';
    }
    // Reset the lastIndex for reuse
    const newRegex = new RegExp(pattern.source, flags);
    return newRegex;
  }

  // Escape special regex characters for string patterns
  let regexStr = escapeRegex(pattern);

  if (wordMatch) {
    regexStr = `\\b${regexStr}\\b`;
  }

  if (lineMatch) {
    regexStr = `^${regexStr}$`;
  }

  const flags = ignoreCase ? 'i' : '';
  return new RegExp(regexStr, flags);
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
