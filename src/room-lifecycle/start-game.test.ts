import { describe, expect, it } from 'vitest';
import { startGame } from './room';
import type { Room } from './room';

function roomWith(players: Room['players']): Room {
  return { code: 'ABCDEF', players, playerCount: 1 + players.length, started: false };
}

describe('startGame', () => {
  it('marks the Room as started once at least one Guest is present', () => {
    const room = roomWith([{ playerId: 'p1', name: 'Alex', connected: true }]);

    const started = startGame(room);

    expect(started.started).toBe(true);
  });

  it('refuses to start a Room with no Guests', () => {
    const room = roomWith([]);

    expect(() => startGame(room)).toThrow();
  });
});
