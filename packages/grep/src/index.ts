/**
 * @btcp/grep
 *
 * Unix-like grep utility for searching text patterns.
 *
 * @example
 * ```typescript
 * import { grep } from '@btcp/grep';
 *
 * const text = `line one
 * line two
 * another line`;
 *
 * const matches = grep('line', text);
 * // Returns: "line one\nline two\nanother line"
 * ```
 */

/**
 * Search for a pattern in text and return matched lines
 *
 * @param pattern - String pattern to search for
 * @param text - Text to search in (can be multi-line)
 * @returns Matched lines joined by newlines
 *
 * @example
 * ```typescript
 * grep('error', logText);
 * // Returns all lines containing "error"
 * ```
 */
export function grep(pattern: string, text: string): string {
  const lines = text.split('\n');
  const matched = lines.filter((line) => line.includes(pattern));
  return matched.join('\n');
}
