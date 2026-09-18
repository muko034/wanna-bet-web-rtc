import { describe, expect, it } from 'vitest';
import type { GameState } from '../protocol/messages';
import { resolveRoundControls } from './round-controls';
import type { Room } from './room';

function roomWith(overrides: Partial<Room> = {}): Room {
  return {
    code: 'ABCDEF',
    hostName: 'Host',
    hostPlayerId: 'host-1',
    players: [{ playerId: 'p1', name: 'Alex', connected: true }],
    playerCount: 2,
    started: true,
    ...overrides,
  };
}

function stateWith(overrides: Partial<GameState> = {}): GameState {
  return {
    roomId: 'ABCDEF',
    status: 'active',
    activePlayerId: 'p1',
    resolution: null,
    players: [
      { playerId: 'host-1', name: 'Host', points: 100, status: 'active', connected: true },
      { playerId: 'p1', name: 'Alex', points: 100, status: 'active', connected: true },
    ],
    round: {
      activePlayerId: 'p1',
      challengeId: 'challenge-1',
      bets: [],
      outcome: null,
    },
    ...overrides,
  };
}

describe('resolveRoundControls', () => {
  it('shows Outcome controls only on the Host device while a Round is open', () => {
    expect(resolveRoundControls({ code: 'ABCDEF', room: roomWith(), gameState: stateWith() })).toEqual({
      kind: 'resolve-round',
    });

    expect(resolveRoundControls({ code: 'ABCDEF', room: null, gameState: stateWith() })).toEqual({
      kind: 'hidden',
    });

    expect(resolveRoundControls({
      code: 'ABCDEF',
      room: roomWith(),
      gameState: stateWith({ round: null }),
    })).toEqual({
      kind: 'start-round',
      activePlayerName: 'Alex',
    });
  });
});
