/**
 * @btcp/grep
 *
 * Unix-like grep utility with full option support.
 *
 * @example
 * ```typescript
 * import { grep } from '@btcp/grep';
 *
 * // Basic usage
 * grep('error', logText);
 *
 * // With options (like grep -i -n)
 * grep('error', logText, { ignoreCase: true, lineNumbers: true });
 *
 * // Regex patterns
 * grep('error|warn', logText);
 * ```
 */

/**
 * Options for grep (mirrors Unix grep flags)
 */
export interface GrepOptions {
  /**
   * Case-insensitive matching (grep -i)
   * @default false
   */
  ignoreCase?: boolean;

  /**
   * Include line numbers in output (grep -n)
   * @default false
   */
  lineNumbers?: boolean;

  /**
   * Invert match - return lines that do NOT match (grep -v)
   * @default false
   */
  invert?: boolean;

  /**
   * Only return count of matching lines (grep -c)
   * @default false
   */
  count?: boolean;

  /**
   * Maximum number of matches to return (grep -m)
   * @default 0 (unlimited)
   */
  maxCount?: number;

  /**
   * Number of context lines after each match (grep -A)
   * @default 0
   */
  after?: number;

  /**
   * Number of context lines before each match (grep -B)
   * @default 0
   */
  before?: number;

  /**
   * Only match whole words (grep -w)
   * @default false
   */
  wordRegexp?: boolean;

  /**
   * Only match whole lines (grep -x)
   * @default false
   */
  lineRegexp?: boolean;

  /**
   * Treat pattern as fixed string, not regex (grep -F)
   * @default false
   */
  fixedStrings?: boolean;
}

/**
 * Search for a pattern in text and return matched lines
 *
 * @param pattern - Regex pattern to search for
 * @param text - Text to search in (can be multi-line)
 * @param options - Grep options (like Unix grep flags)
 * @returns Matched lines joined by newlines, or count if options.count is true
 *
 * @example
 * ```typescript
 * // Simple search
 * grep('error', logText);
 *
 * // Case insensitive (grep -i)
 * grep('error', logText, { ignoreCase: true });
 *
 * // With line numbers (grep -n)
 * grep('error', logText, { lineNumbers: true });
 * // Returns: "5:error occurred\n12:another error"
 *
 * // Invert match (grep -v)
 * grep('debug', logText, { invert: true });
 *
 * // Count only (grep -c)
 * grep('error', logText, { count: true });
 * // Returns: "3"
 *
 * // Context lines (grep -B2 -A2)
 * grep('error', logText, { before: 2, after: 2 });
 *
 * // Max matches (grep -m 5)
 * grep('error', logText, { maxCount: 5 });
 *
 * // Fixed string, not regex (grep -F)
 * grep('[test]', logText, { fixedStrings: true });
 *
 * // Whole word (grep -w)
 * grep('test', logText, { wordRegexp: true });
 *
 * // Whole line (grep -x)
 * grep('exact line', logText, { lineRegexp: true });
 * ```
 */
export function grep(pattern: string, text: string, options: GrepOptions = {}): string {
  const {
    ignoreCase = false,
    lineNumbers = false,
    invert = false,
    count = false,
    maxCount = 0,
    after = 0,
    before = 0,
    wordRegexp = false,
    lineRegexp = false,
    fixedStrings = false,
  } = options;

  const lines = text.split('\n');
  const regex = buildRegex(pattern, { ignoreCase, wordRegexp, lineRegexp, fixedStrings });

  // Find matching line indices
  const matchingIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const matches = regex.test(lines[i]);
    const shouldInclude = invert ? !matches : matches;

    if (shouldInclude) {
      matchingIndices.push(i);
      if (maxCount > 0 && matchingIndices.length >= maxCount) {
        break;
      }
    }
  }

  // Return count if requested
  if (count) {
    return String(matchingIndices.length);
  }

  // Build result with context
  const result: string[] = [];
  const includedIndices = new Set<number>();

  for (const matchIdx of matchingIndices) {
    const startIdx = Math.max(0, matchIdx - before);
    const endIdx = Math.min(lines.length - 1, matchIdx + after);

    for (let i = startIdx; i <= endIdx; i++) {
      if (!includedIndices.has(i)) {
        includedIndices.add(i);
        const line = lines[i];
        if (lineNumbers) {
          const separator = i === matchIdx ? ':' : '-';
          result.push(`${i + 1}${separator}${line}`);
        } else {
          result.push(line);
        }
      }
    }
  }

  // Sort by line number when using context
  if ((before > 0 || after > 0) && result.length > 0) {
    result.sort((a, b) => {
      if (!lineNumbers) return 0;
      const numA = parseInt(a.split(/[:-]/)[0], 10);
      const numB = parseInt(b.split(/[:-]/)[0], 10);
      return numA - numB;
    });
  }

  return result.join('\n');
}

/**
 * Build regex from pattern with options
 */
function buildRegex(
  pattern: string,
  options: {
    ignoreCase: boolean;
    wordRegexp: boolean;
    lineRegexp: boolean;
    fixedStrings: boolean;
  }
): RegExp {
  const { ignoreCase, wordRegexp, lineRegexp, fixedStrings } = options;

  let regexPattern = pattern;

  // Escape if fixed strings mode
  if (fixedStrings) {
    regexPattern = escapeRegex(pattern);
  }

  // Apply word boundary
  if (wordRegexp) {
    regexPattern = `\\b${regexPattern}\\b`;
  }

  // Apply line match
  if (lineRegexp) {
    regexPattern = `^${regexPattern}$`;
  }

  const flags = ignoreCase ? 'i' : '';

  try {
    return new RegExp(regexPattern, flags);
  } catch {
    // Invalid regex - escape and try again
    return new RegExp(escapeRegex(pattern), flags);
  }
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
