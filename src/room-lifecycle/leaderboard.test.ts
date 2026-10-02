import { describe, expect, it } from 'vitest';
import { resolveLeaderboard } from './leaderboard';
import type { Player } from '../protocol/messages';

function playerWith(overrides: Partial<Player>): Player {
  return { playerId: 'p1', name: 'Alex', points: 100, status: 'active', connected: true, ...overrides };
}

describe('resolveLeaderboard', () => {
  it('lists players by Points, highest first, with the local player marked "(you)"', () => {
    const players = [
      playerWith({ playerId: 'a', name: 'Ann', points: 80 }),
      playerWith({ playerId: 'b', name: 'Bob', points: 150 }),
      playerWith({ playerId: 'c', name: 'Cy', points: 120 }),
    ];

    const { rows } = resolveLeaderboard({ players, localPlayerId: 'c' });

    expect(rows.map((row) => [row.playerId, row.nameLabel, row.points])).toEqual([
      ['b', 'Bob', 150],
      ['c', 'Cy (you)', 120],
      ['a', 'Ann', 80],
    ]);
  });

  it('flags only the local row, even when another name ends with "(you)"', () => {
    const players = [
      playerWith({ playerId: 'a', name: 'Ann (you)', points: 80 }),
      playerWith({ playerId: 'b', name: 'Bob', points: 150 }),
    ];

    const { rows } = resolveLeaderboard({ players, localPlayerId: 'b' });

    expect(rows.map((row) => [row.playerId, row.isLocal])).toEqual([
      ['b', true],
      ['a', false],
    ]);
  });

  it('shows the local player rank and Points in the badge', () => {
    const players = [
      playerWith({ playerId: 'a', points: 80 }),
      playerWith({ playerId: 'b', points: 150 }),
      playerWith({ playerId: 'c', points: 120 }),
    ];

    const { badge } = resolveLeaderboard({ players, localPlayerId: 'c' });

    expect(badge).toEqual({ text: '#2 · 120 pts', medal: '🥈' });
  });

  it('gives medals to ranks 1 to 3 only', () => {
    const players = [
      playerWith({ playerId: 'a', points: 400 }),
      playerWith({ playerId: 'b', points: 300 }),
      playerWith({ playerId: 'c', points: 200 }),
      playerWith({ playerId: 'd', points: 100 }),
    ];

    const { rows } = resolveLeaderboard({ players, localPlayerId: 'a' });

    expect(rows.map((row) => row.medal)).toEqual(['🥇', '🥈', '🥉', null]);
  });

  it('shows no medal in the badge for rank 4 and below', () => {
    const players = [
      playerWith({ playerId: 'a', points: 400 }),
      playerWith({ playerId: 'b', points: 300 }),
      playerWith({ playerId: 'c', points: 200 }),
      playerWith({ playerId: 'd', points: 100 }),
    ];

    expect(resolveLeaderboard({ players, localPlayerId: 'd' }).badge).toEqual({ text: '#4 · 100 pts', medal: null });
  });

  it('gives players with equal Points one shared rank and medal (1, 1, 3)', () => {
    const players = [
      playerWith({ playerId: 'a', points: 150 }),
      playerWith({ playerId: 'b', points: 150 }),
      playerWith({ playerId: 'c', points: 90 }),
    ];

    const { rows, badge } = resolveLeaderboard({ players, localPlayerId: 'b' });

    expect(rows.map((row) => [row.rank, row.medal])).toEqual([[1, '🥇'], [1, '🥇'], [3, '🥉']]);
    expect(badge).toEqual({ text: '#1 · 150 pts', medal: '🥇' });
  });

  it('ranks a paused player and flags the row as paused', () => {
    const players = [
      playerWith({ playerId: 'a', points: 100 }),
      playerWith({ playerId: 'b', points: 130, status: 'paused' }),
    ];

    const { rows } = resolveLeaderboard({ players, localPlayerId: 'a' });

    expect(rows.map((row) => [row.playerId, row.rank, row.paused])).toEqual([
      ['b', 1, true],
      ['a', 2, false],
    ]);
  });

  it('hides removed players and does not count them toward ranks', () => {
    const players = [
      playerWith({ playerId: 'a', points: 100 }),
      playerWith({ playerId: 'b', points: 500, status: 'removed' }),
    ];

    const { rows, badge } = resolveLeaderboard({ players, localPlayerId: 'a' });

    expect(rows.map((row) => row.playerId)).toEqual(['a']);
    expect(badge).toEqual({ text: '#1 · 100 pts', medal: '🥇' });
  });

  it('gives a removed local player no badge', () => {
    const players = [
      playerWith({ playerId: 'a', points: 100 }),
      playerWith({ playerId: 'b', points: 50, status: 'removed' }),
    ];

    const { badge, rows } = resolveLeaderboard({ players, localPlayerId: 'b' });

    expect(badge).toBeNull();
    expect(rows.map((row) => row.playerId)).toEqual(['a']);
  });

  it('gives no badge when the local player is unknown', () => {
    const players = [playerWith({ playerId: 'a' })];

    expect(resolveLeaderboard({ players, localPlayerId: null }).badge).toBeNull();
  });

  it('ranks a single player first', () => {
    const { badge, rows } = resolveLeaderboard({ players: [playerWith({ playerId: 'a' })], localPlayerId: 'a' });

    expect(badge).toEqual({ text: '#1 · 100 pts', medal: '🥇' });
    expect(rows).toHaveLength(1);
  });

  it('returns no badge and no rows for a null player list', () => {
    expect(resolveLeaderboard({ players: null, localPlayerId: 'a' })).toEqual({ badge: null, rows: [] });
  });
});
