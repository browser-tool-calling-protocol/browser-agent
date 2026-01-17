import { describe, it, expect } from 'vitest';
import { grep, grepDetailed, grepLines, grepTest } from './index.js';

const sampleText = `line one
line two
another line
Line Three
UPPERCASE LINE
the end`;

describe('grep', () => {
  describe('basic matching', () => {
    it('should match lines containing a string pattern', () => {
      const result = grep('line', sampleText);
      expect(result).toEqual(['line one', 'line two', 'another line']);
    });

    it('should return empty array when no matches', () => {
      const result = grep('nonexistent', sampleText);
      expect(result).toEqual([]);
    });

    it('should handle empty text', () => {
      const result = grep('pattern', '');
      expect(result).toEqual([]);
    });

    it('should handle empty pattern', () => {
      const result = grep('', sampleText);
      expect(result.length).toBe(6); // All lines match empty string
    });
  });

  describe('ignoreCase option', () => {
    it('should perform case-insensitive search', () => {
      const result = grep('line', sampleText, { ignoreCase: true });
      expect(result).toEqual([
        'line one',
        'line two',
        'another line',
        'Line Three',
        'UPPERCASE LINE',
      ]);
    });

    it('should be case-sensitive by default', () => {
      const result = grep('LINE', sampleText);
      expect(result).toEqual(['UPPERCASE LINE']);
    });
  });

  describe('lineNumbers option', () => {
    it('should include line numbers with colon separator', () => {
      const result = grep('line', sampleText, { lineNumbers: true });
      expect(result).toEqual(['1:line one', '2:line two', '3:another line']);
    });

    it('should use 1-based line numbers', () => {
      const result = grep('end', sampleText, { lineNumbers: true });
      expect(result).toEqual(['6:the end']);
    });
  });

  describe('invert option', () => {
    it('should return non-matching lines', () => {
      const result = grep('line', sampleText, { invert: true });
      expect(result).toEqual(['Line Three', 'UPPERCASE LINE', 'the end']);
    });

    it('should work with other options', () => {
      const result = grep('line', sampleText, {
        invert: true,
        lineNumbers: true,
      });
      expect(result).toEqual(['4:Line Three', '5:UPPERCASE LINE', '6:the end']);
    });
  });

  describe('count option', () => {
    it('should return count of matching lines', () => {
      const result = grep('line', sampleText, { count: true });
      expect(result).toBe(3);
    });

    it('should return 0 when no matches', () => {
      const result = grep('xyz', sampleText, { count: true });
      expect(result).toBe(0);
    });

    it('should work with ignoreCase', () => {
      const result = grep('line', sampleText, {
        count: true,
        ignoreCase: true,
      });
      expect(result).toBe(5);
    });
  });

  describe('wordMatch option', () => {
    it('should match whole words only', () => {
      const text = 'test testing tested retest';
      const result = grep('test', text, { wordMatch: true });
      expect(result).toEqual(['test testing tested retest']);
    });

    it('should not match partial words', () => {
      const text = `testing
test
retest`;
      const result = grep('test', text, { wordMatch: true });
      expect(result).toEqual(['test']);
    });
  });

  describe('lineMatch option', () => {
    it('should match whole lines only', () => {
      const text = `line one
one
line`;
      const result = grep('one', text, { lineMatch: true });
      expect(result).toEqual(['one']);
    });

    it('should work with ignoreCase', () => {
      const text = `ONE
one
One test`;
      const result = grep('one', text, { lineMatch: true, ignoreCase: true });
      expect(result).toEqual(['ONE', 'one']);
    });
  });

  describe('maxMatches option', () => {
    it('should limit number of matches', () => {
      const result = grep('line', sampleText, { maxMatches: 2 });
      expect(result).toEqual(['line one', 'line two']);
    });

    it('should return all matches if maxMatches is 0', () => {
      const result = grep('line', sampleText, { maxMatches: 0 });
      expect(result).toEqual(['line one', 'line two', 'another line']);
    });
  });

  describe('context options (before/after)', () => {
    it('should include lines before matches', () => {
      const result = grep('Three', sampleText, {
        before: 1,
        ignoreCase: true,
      });
      expect(result).toEqual(['another line', 'Line Three']);
    });

    it('should include lines after matches', () => {
      const result = grep('one', sampleText, { after: 1 });
      expect(result).toEqual(['line one', 'line two']);
    });

    it('should include context before and after', () => {
      const result = grep('another', sampleText, { before: 1, after: 1 });
      expect(result).toEqual(['line two', 'another line', 'Line Three']);
    });

    it('should use - separator for context lines with line numbers', () => {
      const result = grep('another', sampleText, {
        before: 1,
        after: 1,
        lineNumbers: true,
      });
      expect(result).toEqual(['2-line two', '3:another line', '4-Line Three']);
    });
  });

  describe('regex patterns', () => {
    it('should support regex patterns', () => {
      const result = grep(/line \w+/, sampleText);
      expect(result).toEqual(['line one', 'line two']);
    });

    it('should support regex with flags', () => {
      const result = grep(/LINE/i, sampleText);
      expect(result).toEqual([
        'line one',
        'line two',
        'another line',
        'Line Three',
        'UPPERCASE LINE',
      ]);
    });

    it('should escape special characters in string patterns', () => {
      const text = 'test.* pattern\ntest123 pattern';
      const result = grep('test.*', text);
      expect(result).toEqual(['test.* pattern']);
    });
  });
});

describe('grepDetailed', () => {
  it('should return detailed match information', () => {
    const result = grepDetailed('line', sampleText);
    expect(result).toEqual([
      { line: 'line one', lineNumber: 1, isContext: false },
      { line: 'line two', lineNumber: 2, isContext: false },
      { line: 'another line', lineNumber: 3, isContext: false },
    ]);
  });

  it('should mark context lines correctly', () => {
    const result = grepDetailed('another', sampleText, { before: 1, after: 1 });
    expect(result).toEqual([
      { line: 'line two', lineNumber: 2, isContext: true },
      { line: 'another line', lineNumber: 3, isContext: false },
      { line: 'Line Three', lineNumber: 4, isContext: true },
    ]);
  });
});

describe('grepLines', () => {
  it('should work with array of lines', () => {
    const lines = ['line one', 'line two', 'other'];
    const result = grepLines('line', lines);
    expect(result).toEqual(['line one', 'line two']);
  });

  it('should support all options', () => {
    const lines = ['Line One', 'line two', 'other'];
    const result = grepLines('line', lines, {
      ignoreCase: true,
      lineNumbers: true,
    });
    expect(result).toEqual(['1:Line One', '2:line two']);
  });

  it('should support count option', () => {
    const lines = ['a', 'b', 'a', 'c'];
    const result = grepLines('a', lines, { count: true });
    expect(result).toBe(2);
  });
});

describe('grepTest', () => {
  it('should return true if pattern is found', () => {
    expect(grepTest('line', sampleText)).toBe(true);
  });

  it('should return false if pattern is not found', () => {
    expect(grepTest('xyz', sampleText)).toBe(false);
  });

  it('should support ignoreCase', () => {
    expect(grepTest('LINE', sampleText, { ignoreCase: true })).toBe(true);
    expect(grepTest('LINE', 'line one')).toBe(false);
  });

  it('should support wordMatch', () => {
    expect(grepTest('line', 'lines', { wordMatch: true })).toBe(false);
    expect(grepTest('line', 'a line here', { wordMatch: true })).toBe(true);
  });

  it('should support lineMatch', () => {
    expect(grepTest('line', 'line one', { lineMatch: true })).toBe(false);
    expect(grepTest('line', 'line', { lineMatch: true })).toBe(true);
  });
});
