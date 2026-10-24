import { describe, expect, it } from 'vitest';
import { MAX_NAME_LENGTH, normalizeName, truncateName } from './player-name';

describe('normalizeName', () => {
  it.each([
    ['empty', '', '', false],
    ['spaces only', '   ', '', false],
    ['tabs and newlines only', '\t\n ', '', false],
    ['plain name', 'Anna', 'Anna', true],
    ['surrounding spaces', '  Anna ', 'Anna', true],
    ['inner spaces kept', ' Anna Maria ', 'Anna Maria', true],
    ['exactly 16 characters', 'a'.repeat(16), 'a'.repeat(16), true],
    ['17 characters', 'a'.repeat(17), 'a'.repeat(17), false],
    ['16 characters plus surrounding spaces', ` ${'a'.repeat(16)} `, 'a'.repeat(16), true],
    ['16 emoji', '😀'.repeat(16), '😀'.repeat(16), true],
    ['17 emoji', '😀'.repeat(17), '😀'.repeat(17), false],
    ['16 accented letters, combining marks', 'é'.repeat(16), 'é'.repeat(16), true],
    ['17 accented letters', 'ą'.repeat(17), 'ą'.repeat(17), false],
    ['a family emoji is one character', '👨‍👩‍👧‍👦'.repeat(16), '👨‍👩‍👧‍👦'.repeat(16), true],
  ])('%s', (_label, raw, name, valid) => {
    expect(normalizeName(raw)).toEqual({ name, valid });
  });
});

describe('truncateName', () => {
  it.each([
    ['short text is unchanged', 'Anna', 'Anna'],
    ['text at the limit is unchanged', 'a'.repeat(16), 'a'.repeat(16)],
    ['long text is cut to the limit', 'a'.repeat(30), 'a'.repeat(16)],
    ['an emoji is never cut in half', '😀'.repeat(20), '😀'.repeat(16)],
  ])('%s', (_label, raw, expected) => {
    expect(truncateName(raw)).toBe(expected);
  });

  it('exposes the limit', () => {
    expect(MAX_NAME_LENGTH).toBe(16);
  });
});
