import { describe, expect, it } from 'vitest';
import { buildInitialGameState, STARTING_POINTS } from './game-state';
import type { Room } from './room';

function roomWith(players: Room['players']): Room {
  return { code: 'ABCDEF', hostName: 'Host', hostPlayerId: 'host-1', players, playerCount: 1 + players.length, started: false };
}

describe('buildInitialGameState', () => {
  it('includes the Host alongside every connected Guest, each starting at the same Points, with no Round yet', () => {
    const room = roomWith([
      { playerId: 'p1', name: 'Alex', connected: true },
      { playerId: 'p2', name: 'Sam', connected: true },
    ]);

    const state = buildInitialGameState(room);

    expect(state).toEqual({
      roomId: 'ABCDEF',
      status: 'active',
      round: null,
      players: [
        { playerId: 'host-1', name: 'Host', points: STARTING_POINTS, status: 'active', connected: true },
        { playerId: 'p1', name: 'Alex', points: STARTING_POINTS, status: 'active', connected: true },
        { playerId: 'p2', name: 'Sam', points: STARTING_POINTS, status: 'active', connected: true },
      ],
    });
  });

  it("carries forward a Guest's live connection status", () => {
    const room = roomWith([{ playerId: 'p1', name: 'Alex', connected: false }]);

    const state = buildInitialGameState(room);

    expect(state.players.find((p) => p.playerId === 'p1')).toEqual(
      expect.objectContaining({ connected: false }),
    );
  });
});
