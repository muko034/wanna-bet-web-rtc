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
    challengerId: 'p1',
    resolution: null,
    players: [
      { playerId: 'host-1', name: 'Host', points: 100, status: 'active', connected: true },
      { playerId: 'p1', name: 'Alex', points: 100, status: 'active', connected: true },
    ],
    round: {
      challengerId: 'p1',
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

  function roundWith(challengerId: string, bettorIds: string[]): GameState['round'] {
    return {
      challengerId,
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

  it.each([
    { name: 'sat out', pausedBy: 'self' as const },
    { name: 'paused by the Host', pausedBy: 'host' as const },
  ])('shows the judging screen without waiting for a Bettor who is $name', ({ pausedBy }) => {
    const players = threePlayers.map((player) =>
      player.playerId === 'p2' ? { ...player, status: 'paused' as const, pausedBy } : player,
    );

    expect(resolveRoundControls({
      code: 'ABCDEF',
      room: roomWith(),
      gameState: stateWith({ players, round: roundWith('p1', ['host-1']) }),
    })).toEqual({ kind: 'judge-round', title: { key: 'judge.title', params: { name: 'Alex' } }, background: 'vb-bg-judge' });
  });

  it('shows the judging screen on the Host device as soon as the last Bettor has bet', () => {
    expect(resolveRoundControls({
      code: 'ABCDEF',
      room: roomWith(),
      gameState: stateWith({ players: threePlayers, round: roundWith('p1', ['host-1', 'p2']) }),
    })).toEqual({ kind: 'judge-round', title: { key: 'judge.title', params: { name: 'Alex' } }, background: 'vb-bg-judge' });
  });

  it('shows the judging screen to a Host who is the Challenger once every other player has bet', () => {
    const gameState = stateWith({
      challengerId: 'host-1',
      players: threePlayers,
      round: roundWith('host-1', ['p1']),
    });
    expect(resolveRoundControls({ code: 'ABCDEF', room: roomWith(), gameState })).toEqual({ kind: 'hidden' });

    expect(resolveRoundControls({
      code: 'ABCDEF',
      room: roomWith(),
      gameState: stateWith({ challengerId: 'host-1', players: threePlayers, round: roundWith('host-1', ['p1', 'p2']) }),
    })).toEqual({ kind: 'judge-round', title: { key: 'judge.title', params: { name: 'Host' } }, background: 'vb-bg-judge' });
  });

  it('never shows an Outcome control on a non-Host device, even once all Bets are in', () => {
    expect(resolveRoundControls({
      code: 'ABCDEF',
      room: null,
      gameState: stateWith({ players: threePlayers, round: roundWith('p1', ['host-1', 'p2']) }),
    })).toEqual({ kind: 'hidden' });
  });

  it('shows no control while no Round is open (the brief gap before the next Round auto-starts)', () => {
    expect(resolveRoundControls({
      code: 'ABCDEF',
      room: roomWith(),
      gameState: stateWith({ round: null }),
    })).toEqual({ kind: 'hidden' });
  });

  it('shows no control before the Room or game state is known', () => {
    expect(resolveRoundControls({ code: 'ABCDEF', room: roomWith(), gameState: null })).toEqual({ kind: 'hidden' });
    expect(resolveRoundControls({ code: undefined, room: roomWith(), gameState: stateWith() })).toEqual({
      kind: 'hidden',
    });
  });
  describe('when no Guest is active', () => {
    const players = (guestStatuses: Array<'active' | 'paused'>): GameState['players'] => [
      { playerId: 'host-1', name: 'Host', points: 100, status: 'active', connected: true },
      ...guestStatuses.map((status, index) => ({
        playerId: `p${index + 1}`,
        name: `Guest ${index + 1}`,
        points: 100,
        status,
        connected: status === 'active',
      })),
    ];

    it.each([
      ['mid-Round, instead of the judging screen', roundWith('host-1', [])],
      ['in the gap between Rounds', null],
    ])('offers only End game when every Guest sat out %s', (_label, round) => {
      expect(resolveRoundControls({
        code: 'ABCDEF',
        room: roomWith(),
        gameState: stateWith({ players: players(['paused', 'paused']), round }),
      })).toEqual({ kind: 'no-active-guests', background: 'vb-bg-wait' });
    });

    it('keeps the usual controls while at least one Guest is still active', () => {
      expect(resolveRoundControls({
        code: 'ABCDEF',
        room: roomWith(),
        gameState: stateWith({ players: players(['paused', 'active']), round: roundWith('host-1', ['p2']) }),
      })).toEqual({ kind: 'judge-round', title: { key: 'judge.title', params: { name: 'Host' } }, background: 'vb-bg-judge' });
    });

    it('never shows it on a Guest device or after the game ended', () => {
      expect(resolveRoundControls({ code: 'ABCDEF', room: null, gameState: stateWith({ players: players(['paused']) }) })).toEqual({ kind: 'hidden' });
      expect(resolveRoundControls({
        code: 'ABCDEF',
        room: roomWith(),
        gameState: stateWith({ status: 'ended', players: players(['paused']) }),
      })).toEqual({ kind: 'hidden' });
    });
  });
});
