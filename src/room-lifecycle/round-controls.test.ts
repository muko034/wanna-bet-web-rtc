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
  const threePlayers: GameState['players'] = [
    { playerId: 'host-1', name: 'Host', points: 100, status: 'active', connected: true },
    { playerId: 'p1', name: 'Alex', points: 100, status: 'active', connected: true },
    { playerId: 'p2', name: 'Sam', points: 100, status: 'active', connected: true },
  ];

  function roundWith(activePlayerId: string, bettorIds: string[]): GameState['round'] {
    return {
      activePlayerId,
      challengeId: 'challenge-1',
      bets: bettorIds.map((playerId) => ({ playerId })),
      outcome: null,
    };
  }

  it('shows no Outcome control on the Host device while any Bettor has yet to bet', () => {
    // Host is a Bettor who has not bet, plus another Bettor who has not bet.
    expect(resolveRoundControls({
      code: 'ABCDEF',
      room: roomWith(),
      gameState: stateWith({ players: threePlayers, round: roundWith('p1', []) }),
    })).toEqual({ kind: 'hidden' });

    // Only the last Bettor (Sam) is missing.
    expect(resolveRoundControls({
      code: 'ABCDEF',
      room: roomWith(),
      gameState: stateWith({ players: threePlayers, round: roundWith('p1', ['host-1']) }),
    })).toEqual({ kind: 'hidden' });
  });

  it('shows the judging screen on the Host device as soon as the last Bettor has bet', () => {
    expect(resolveRoundControls({
      code: 'ABCDEF',
      room: roomWith(),
      gameState: stateWith({ players: threePlayers, round: roundWith('p1', ['host-1', 'p2']) }),
    })).toEqual({ kind: 'judge-round', activePlayerName: 'Alex', background: 'vb-bg-judge' });
  });

  it('shows the judging screen to a Host who is the Active Player once every other player has bet', () => {
    const gameState = stateWith({
      activePlayerId: 'host-1',
      players: threePlayers,
      round: roundWith('host-1', ['p1']),
    });
    expect(resolveRoundControls({ code: 'ABCDEF', room: roomWith(), gameState })).toEqual({ kind: 'hidden' });

    expect(resolveRoundControls({
      code: 'ABCDEF',
      room: roomWith(),
      gameState: stateWith({ activePlayerId: 'host-1', players: threePlayers, round: roundWith('host-1', ['p1', 'p2']) }),
    })).toEqual({ kind: 'judge-round', activePlayerName: 'Host', background: 'vb-bg-judge' });
  });

  it('never shows an Outcome control on a non-Host device, even once all Bets are in', () => {
    expect(resolveRoundControls({
      code: 'ABCDEF',
      room: null,
      gameState: stateWith({ players: threePlayers, round: roundWith('p1', ['host-1', 'p2']) }),
    })).toEqual({ kind: 'hidden' });
  });

  it('offers to start the next Round on the Host device when no Round is open', () => {
    expect(resolveRoundControls({
      code: 'ABCDEF',
      room: roomWith(),
      gameState: stateWith({ round: null }),
    })).toEqual({ kind: 'start-round', activePlayerName: 'Alex' });
  });

  it('shows no control before the Room or game state is known', () => {
    expect(resolveRoundControls({ code: 'ABCDEF', room: roomWith(), gameState: null })).toEqual({ kind: 'hidden' });
    expect(resolveRoundControls({ code: undefined, room: roomWith(), gameState: stateWith() })).toEqual({
      kind: 'hidden',
    });
  });
});
