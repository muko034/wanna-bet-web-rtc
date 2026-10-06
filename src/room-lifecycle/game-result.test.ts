import { describe, expect, it } from 'vitest';
import type { GameState, Player } from '../protocol/messages';
import { resolveGameResult } from './game-result';

function player(playerId: string, name: string, points: number, status: Player['status'] = 'active'): Player {
  return { playerId, name, points, status, connected: true };
}

function stateWith(players: Player[], status: GameState['status'] = 'ended'): GameState {
  return { roomId: 'ABCDEF', status, challengerId: null, resolution: null, round: null, players };
}

describe('resolveGameResult', () => {
  it.each([
    ['an active Game', 'active'],
    ['a Lobby', 'lobby'],
  ] as const)('shows no Game Result Screen for %s', (_name, status) => {
    expect(resolveGameResult({ gameState: stateWith([player('a', 'Ann', 5)], status), localPlayerId: 'a' })).toBeNull();
  });

  it('shows no Game Result Screen before any state has arrived', () => {
    expect(resolveGameResult({ gameState: null, localPlayerId: null })).toBeNull();
  });

  it('lists the final Leaderboard by Points with the local player marked', () => {
    const result = resolveGameResult({
      gameState: stateWith([player('a', 'Ann', 80), player('b', 'Bob', 120)]),
      localPlayerId: 'a',
    });

    expect(result?.rows).toEqual([
      expect.objectContaining({ playerId: 'b', rank: 1, nameLabel: 'Bob', points: 120 }),
      expect.objectContaining({ playerId: 'a', rank: 2, nameLabel: 'Ann (you)', points: 80 }),
    ]);
  });

  it.each([
    ['a single top player', [player('a', 'Ann', 80), player('b', 'Bob', 120), player('c', 'Cy', 100)], ['b']],
    ['a tie on the top Points', [player('a', 'Ann', 120), player('b', 'Bob', 120), player('c', 'Cy', 100)], ['a', 'b']],
    ['everyone tied', [player('a', 'Ann', 100), player('b', 'Bob', 100)], ['a', 'b']],
    ['a sat-out player on top', [player('a', 'Ann', 90), player('b', 'Bob', 130, 'paused')], ['b']],
    ['a removed player on top', [player('a', 'Ann', 90), player('b', 'Bob', 130, 'removed')], ['a']],
  ])('marks every Winner with %s', (_name, players, winnerIds) => {
    const result = resolveGameResult({ gameState: stateWith(players), localPlayerId: null });

    expect(result?.rows.filter((row) => row.isWinner).map((row) => row.playerId).sort()).toEqual(winnerIds);
  });
});
