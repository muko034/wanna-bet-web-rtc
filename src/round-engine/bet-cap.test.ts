import { describe, expect, it } from 'vitest';
import { maxBetAmount } from './bet-cap';

describe('maxBetAmount', () => {
  it.each([
    [100, 50],
    [10, 5],
    [4, 2],
    [2, 1],
  ])('caps a player with %i Points at half their Points (%i)', (points, expected) => {
    expect(maxBetAmount(points)).toBe(expected);
  });

  it.each([
    [11, 5],
    [3, 1],
    [101, 50],
  ])('rounds odd Points down: %i Points cap at %i', (points, expected) => {
    expect(maxBetAmount(points)).toBe(expected);
  });

  it('lets a player with exactly 1 Point still bet that 1 Point', () => {
    expect(maxBetAmount(1)).toBe(1);
  });
});
