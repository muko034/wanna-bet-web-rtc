import { describe, expect, it } from 'vitest';
import { applyRoundEngineState, buildInitialGameState, buildLobbyGameState, STARTING_POINTS } from './game-state';
import type { Room } from './room';
import type { RoundEngineState } from '../round-engine/round-engine';

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
      activePlayerId: null,
      resolution: null,
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

describe('buildLobbyGameState', () => {
  it('includes the Host alongside every connected Guest, with no open Round and no Resolution', () => {
    const room = roomWith([
      { playerId: 'p1', name: 'Alex', connected: true },
      { playerId: 'p2', name: 'Sam', connected: false },
    ]);

    const state = buildLobbyGameState(room);

    expect(state).toEqual({
      roomId: 'ABCDEF',
      status: 'lobby',
      activePlayerId: null,
      resolution: null,
      round: null,
      players: [
        { playerId: 'host-1', name: 'Host', points: STARTING_POINTS, status: 'active', connected: true },
        { playerId: 'p1', name: 'Alex', points: STARTING_POINTS, status: 'active', connected: true },
        { playerId: 'p2', name: 'Sam', points: STARTING_POINTS, status: 'active', connected: false },
      ],
    });
  });
});

describe('applyRoundEngineState', () => {
  it('publishes the next Active Player plus the last Resolution summary after a round resolves', () => {
    const initialGameState = buildInitialGameState(
      roomWith([
        { playerId: 'p1', name: 'Alex', connected: true },
        { playerId: 'p2', name: 'Sam', connected: true },
      ]),
    );
    const roundEngineState: RoundEngineState = {
      playerOrder: ['p2', 'host-1', 'p1'],
      points: { 'host-1': 115, p1: 120, p2: 85 },
      challengeHistory: ['c1'],
      round: null,
    };

    const next = applyRoundEngineState(initialGameState, roundEngineState, {
      activePlayerId: 'host-1',
      outcome: 'YES',
      payouts: [
        { playerId: 'host-1', amount: 15 },
        { playerId: 'p1', amount: 20 },
        { playerId: 'p2', amount: -15 },
      ],
    });

    expect(next.activePlayerId).toBe('p2');
    expect(next.resolution).toEqual({
      activePlayerId: 'host-1',
      outcome: 'YES',
      payouts: [
        { playerId: 'host-1', amount: 15 },
        { playerId: 'p1', amount: 20 },
        { playerId: 'p2', amount: -15 },
      ],
    });
    expect(next.round).toBeNull();
    expect(next.players).toEqual([
      { playerId: 'host-1', name: 'Host', points: 115, status: 'active', connected: true },
      { playerId: 'p1', name: 'Alex', points: 120, status: 'active', connected: true },
      { playerId: 'p2', name: 'Sam', points: 85, status: 'active', connected: true },
    ]);
  });
});
