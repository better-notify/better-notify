import { describe, expect, it } from 'vitest';
import { obscureString } from './obscure-string.js';

describe('obscureString', () => {
  it('obscures the middle of a long-enough string', () => {
    expect(obscureString('1234567890', 2, 2)).toBe('12******90');
  });

  it('uses visibleStart and visibleEnd asymmetrically', () => {
    expect(obscureString('abcdefgh', 3, 1)).toBe('abc****h');
  });

  it('returns the input unchanged when too short to obscure', () => {
    expect(obscureString('ab', 1, 1)).toBe('ab');
    expect(obscureString('a', 1, 1)).toBe('a');
    expect(obscureString('', 1, 1)).toBe('');
  });

  it('obscures a single character when exactly one is available', () => {
    expect(obscureString('abc', 1, 1)).toBe('a*c');
  });

  it('returns input unchanged when visibleStart + visibleEnd >= length', () => {
    expect(obscureString('hello', 3, 2)).toBe('hello');
    expect(obscureString('hello', 5, 0)).toBe('hello');
  });

  it('handles zero visibility on either side', () => {
    expect(obscureString('hello', 0, 0)).toBe('*****');
    expect(obscureString('hello', 0, 2)).toBe('***lo');
    expect(obscureString('hello', 2, 0)).toBe('he***');
  });
});
