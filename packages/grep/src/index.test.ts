import { describe, it, expect } from 'vitest';
import { grep } from './index.js';

const sampleText = `line one
line two
another line
Line Three
UPPERCASE LINE
the end`;

describe('grep', () => {
  it('should match lines containing the pattern', () => {
    const result = grep('line', sampleText);
    expect(result).toBe('line one\nline two\nanother line');
  });

  it('should return empty string when no matches', () => {
    const result = grep('nonexistent', sampleText);
    expect(result).toBe('');
  });

  it('should handle empty text', () => {
    const result = grep('pattern', '');
    expect(result).toBe('');
  });

  it('should handle empty pattern (matches all lines)', () => {
    const result = grep('', sampleText);
    expect(result).toBe(sampleText);
  });

  it('should be case-sensitive', () => {
    const result = grep('LINE', sampleText);
    expect(result).toBe('UPPERCASE LINE');
  });

  it('should match partial strings', () => {
    const result = grep('end', sampleText);
    expect(result).toBe('the end');
  });

  it('should handle single line text', () => {
    const result = grep('test', 'this is a test');
    expect(result).toBe('this is a test');
  });

  it('should handle multiple matches on same concept', () => {
    const text = 'error: something\nwarning: else\nerror: another';
    const result = grep('error', text);
    expect(result).toBe('error: something\nerror: another');
  });
});
