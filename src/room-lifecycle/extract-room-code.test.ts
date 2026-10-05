import { describe, expect, it } from 'vitest';
import { extractRoomCode } from './extract-room-code';

describe('extractRoomCode', () => {
  it.each([
    ['plain code', 'ABCDEF', 'ABCDEF'],
    ['lowercase code', 'abcdef', 'ABCDEF'],
    ['padded whitespace', '  abcdef \n', 'ABCDEF'],
    ['full URL', 'https://example.com/room/abcdef', 'ABCDEF'],
    ['URL with base path', 'https://user.github.io/wanna-bet/room/abcdef', 'ABCDEF'],
    ['URL with trailing slash', 'https://example.com/room/abcdef/', 'ABCDEF'],
    ['URL with query string', 'https://example.com/room/abcdef?x=1#top', 'ABCDEF'],
    ['empty input', '', ''],
  ])('%s', (_name, input, expected) => {
    expect(extractRoomCode(input)).toBe(expected);
  });
});
