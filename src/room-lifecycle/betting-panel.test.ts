import { describe, expect, it } from 'vitest';
import type { GameState } from '../protocol/messages';
import { resolveBettingPanel } from './betting-panel';

function stateWith(overrides: Partial<GameState> = {}): GameState {
  return {
    roomId: 'ABCDEF',
    status: 'active',
    players: [
      { playerId: 'host-1', name: 'Host', points: 100, status: 'active', connected: true },
      { playerId: 'guest-1', name: 'Alex', points: 100, status: 'active', connected: true },
      { playerId: 'guest-2', name: 'Sam', points: 100, status: 'active', connected: true },
    ],
    round: {
      activePlayerId: 'guest-1',
      challengeId: 'challenge-1',
      bets: [],
      outcome: null,
    },
    ...overrides,
  };
}

describe('resolveBettingPanel', () => {
  it.each([
    ['the Host when another player is active', 'host-1'],
    ['a Guest who is not the Active Player and has not bet yet', 'guest-2'],
  ])('shows a Bet form for %s', (_label, localPlayerId) => {
    const panel = resolveBettingPanel({ gameState: stateWith(), localPlayerId });

    expect(panel.kind).toBe('form');
  });

  it.each([
    ['the Active Player', 'guest-1'],
    ['a Bettor who already placed a Bet', 'guest-2'],
  ])('does not show the Bet form for %s', (_label, localPlayerId) => {
    const panel = resolveBettingPanel({
      gameState: stateWith({
        round: {
          activePlayerId: 'guest-1',
          challengeId: 'challenge-1',
          bets: localPlayerId === 'guest-2' ? [{ playerId: 'guest-2' }] : [],
          outcome: null,
        },
      }),
      localPlayerId,
    });

    expect(panel.kind).not.toBe('form');
  });

  it('returns an optimistic submitted status before the Host rebroadcast arrives', () => {
    const panel = resolveBettingPanel({
      gameState: stateWith(),
      localPlayerId: 'guest-2',
      locallySubmittedBet: true,
    });

    expect(panel).toMatchObject({
      kind: 'submitted',
      bettors: [
        { playerId: 'host-1', hasBet: false },
        { playerId: 'guest-2', hasBet: false },
      ],
    });
  });

  it('derives each Bettor\'s public "has bet" status from the broadcast GameState without any amount or Prediction fields', () => {
    const panel = resolveBettingPanel({
      gameState: stateWith({
        round: {
          activePlayerId: 'guest-1',
          challengeId: 'challenge-1',
          bets: [{ playerId: 'host-1' }, { playerId: 'guest-2' }],
          outcome: null,
        },
      }),
      localPlayerId: 'guest-2',
    });

    expect(panel.bettors).toEqual([
      { playerId: 'host-1', name: 'Host', hasBet: true, isLocalPlayer: false },
      { playerId: 'guest-2', name: 'Sam', hasBet: true, isLocalPlayer: true },
    ]);
  });
});
