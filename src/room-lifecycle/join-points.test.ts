import { describe, expect, it } from 'vitest';
import type { Player } from '../protocol/messages';
import { defaultJoinPoints, parseJoinPoints } from './join-points';

const player = (name: string, points: number, status: Player['status'] = 'active'): Player => ({
  playerId: name,
  name,
  points,
  status,
  connected: true,
});

describe('defaultJoinPoints', () => {
  it('is the lowest Points among active players, the Host included', () => {
    expect(defaultJoinPoints([player('Host', 80), player('Sam', 120), player('Kim', 95)])).toBe(80);
  });

  it('ignores Paused and Removed players', () => {
    const players = [player('Host', 100), player('Sam', 10, 'paused'), player('Kim', 5, 'removed'), player('Lee', 90)];

    expect(defaultJoinPoints(players)).toBe(90);
  });
});

describe('parseJoinPoints', () => {
  it.each([
    ['one', '1', 1],
    ['a typical value', '70', 70],
    ['a value far above the starting Points', '1000000', 1000000],
    ['surrounding spaces', ' 25 ', 25],
  ])('accepts %s', (_name, text, expected) => {
    expect(parseJoinPoints(text)).toBe(expected);
  });

  it.each([
    ['empty', ''],
    ['blank', '   '],
    ['zero', '0'],
    ['negative', '-3'],
    ['fractional', '2.5'],
    ['fractional with a comma', '2,5'],
    ['text', 'abc'],
    ['too large to count exactly', '9'.repeat(30)],
  ])('refuses %s', (_name, text) => {
    expect(parseJoinPoints(text)).toBeNull();
  });
});
