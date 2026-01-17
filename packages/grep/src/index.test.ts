import { describe, it, expect } from 'vitest';
import { grep } from './index.js';

const sampleText = `line one
line two
another line
Line Three
UPPERCASE LINE
the end`;

describe('grep', () => {
  describe('basic matching', () => {
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

    it('should be case-sensitive by default', () => {
      const result = grep('LINE', sampleText);
      expect(result).toBe('UPPERCASE LINE');
    });
  });

  describe('regex patterns', () => {
    it('should support OR patterns with |', () => {
      const result = grep('one|two', sampleText);
      expect(result).toBe('line one\nline two');
    });

    it('should support start of line anchor ^', () => {
      const result = grep('^line', sampleText);
      expect(result).toBe('line one\nline two');
    });

    it('should support end of line anchor $', () => {
      const result = grep('end$', sampleText);
      expect(result).toBe('the end');
    });

    it('should support character classes \\d', () => {
      const text = 'user1\nuser2\nuser10\nadmin';
      const result = grep('user\\d', text);
      expect(result).toBe('user1\nuser2\nuser10');
    });

    it('should support dot wildcard', () => {
      const text = 'cat\ncut\ncot\ncar';
      const result = grep('c.t', text);
      expect(result).toBe('cat\ncut\ncot');
    });

    it('should support quantifiers', () => {
      const text = 'a\naa\naaa\naaaa';
      const result = grep('a{2,3}', text);
      expect(result).toBe('aa\naaa\naaaa');
    });
  });

  describe('ignoreCase option (-i)', () => {
    it('should match case-insensitively', () => {
      const result = grep('line', sampleText, { ignoreCase: true });
      expect(result).toBe('line one\nline two\nanother line\nLine Three\nUPPERCASE LINE');
    });

    it('should work with regex patterns', () => {
      const result = grep('^line', sampleText, { ignoreCase: true });
      expect(result).toBe('line one\nline two\nLine Three');
    });
  });

  describe('lineNumbers option (-n)', () => {
    it('should include line numbers with colon', () => {
      const result = grep('line', sampleText, { lineNumbers: true });
      expect(result).toBe('1:line one\n2:line two\n3:another line');
    });

    it('should use 1-based line numbers', () => {
      const result = grep('end', sampleText, { lineNumbers: true });
      expect(result).toBe('6:the end');
    });
  });

  describe('invert option (-v)', () => {
    it('should return non-matching lines', () => {
      const result = grep('line', sampleText, { invert: true });
      expect(result).toBe('Line Three\nUPPERCASE LINE\nthe end');
    });

    it('should work with other options', () => {
      const result = grep('line', sampleText, { invert: true, lineNumbers: true });
      expect(result).toBe('4:Line Three\n5:UPPERCASE LINE\n6:the end');
    });
  });

  describe('count option (-c)', () => {
    it('should return count of matching lines', () => {
      const result = grep('line', sampleText, { count: true });
      expect(result).toBe('3');
    });

    it('should return 0 when no matches', () => {
      const result = grep('xyz', sampleText, { count: true });
      expect(result).toBe('0');
    });

    it('should work with ignoreCase', () => {
      const result = grep('line', sampleText, { count: true, ignoreCase: true });
      expect(result).toBe('5');
    });
  });

  describe('maxCount option (-m)', () => {
    it('should limit number of matches', () => {
      const result = grep('line', sampleText, { maxCount: 2 });
      expect(result).toBe('line one\nline two');
    });

    it('should return all if maxCount is 0', () => {
      const result = grep('line', sampleText, { maxCount: 0 });
      expect(result).toBe('line one\nline two\nanother line');
    });
  });

  describe('context options (-A, -B)', () => {
    it('should include lines after match (-A)', () => {
      const result = grep('another', sampleText, { after: 1 });
      expect(result).toBe('another line\nLine Three');
    });

    it('should include lines before match (-B)', () => {
      const result = grep('another', sampleText, { before: 1 });
      expect(result).toBe('line two\nanother line');
    });

    it('should include context before and after', () => {
      const result = grep('another', sampleText, { before: 1, after: 1 });
      expect(result).toBe('line two\nanother line\nLine Three');
    });

    it('should use - separator for context lines with line numbers', () => {
      const result = grep('another', sampleText, { before: 1, after: 1, lineNumbers: true });
      expect(result).toBe('2-line two\n3:another line\n4-Line Three');
    });
  });

  describe('wordRegexp option (-w)', () => {
    it('should match whole words only', () => {
      const text = 'test\ntesting\nretest\ntest case';
      const result = grep('test', text, { wordRegexp: true });
      expect(result).toBe('test\ntest case');
    });

    it('should not match partial words', () => {
      const text = 'testing\ntested\nretest';
      const result = grep('test', text, { wordRegexp: true });
      expect(result).toBe('');
    });
  });

  describe('lineRegexp option (-x)', () => {
    it('should match whole lines only', () => {
      const text = 'test\ntest line\nline test';
      const result = grep('test', text, { lineRegexp: true });
      expect(result).toBe('test');
    });

    it('should work with ignoreCase', () => {
      const text = 'TEST\ntest\nTest Line';
      const result = grep('test', text, { lineRegexp: true, ignoreCase: true });
      expect(result).toBe('TEST\ntest');
    });
  });

  describe('fixedStrings option (-F)', () => {
    it('should treat pattern as literal string', () => {
      const text = 'test [bracket]\ntest other\n[bracket] only';
      const result = grep('[bracket]', text, { fixedStrings: true });
      expect(result).toBe('test [bracket]\n[bracket] only');
    });

    it('should not interpret regex special chars', () => {
      const text = 'file.txt\nfiletxt\nfile-txt';
      const result = grep('file.txt', text, { fixedStrings: true });
      expect(result).toBe('file.txt');
    });

    it('should escape all regex metacharacters', () => {
      const text = 'a*b+c?\nother';
      const result = grep('a*b+c?', text, { fixedStrings: true });
      expect(result).toBe('a*b+c?');
    });
  });

  describe('combined options', () => {
    it('should combine -i -n -v', () => {
      const text = 'Error\nerror\nWarning\nInfo';
      const result = grep('error', text, { ignoreCase: true, invert: true, lineNumbers: true });
      expect(result).toBe('3:Warning\n4:Info');
    });

    it('should combine -w -i', () => {
      const text = 'Test\nTesting\ntest case\nTEST';
      const result = grep('test', text, { wordRegexp: true, ignoreCase: true });
      expect(result).toBe('Test\ntest case\nTEST');
    });
  });
});
