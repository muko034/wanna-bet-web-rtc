import { describe, expect, it } from 'vitest';
import type { GameState } from '../protocol/messages';
import { resolveBettingPanel } from './betting-panel';

function stateWith(overrides: Partial<GameState> = {}): GameState {
  return {
    roomId: 'ABCDEF',
    status: 'active',
    activePlayerId: 'guest-1',
    resolution: null,
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

  it('offers the Bet form on the orange betting background with the slider bounds from the local Points', () => {
    const panel = resolveBettingPanel({
      gameState: stateWith({
        players: [
          { playerId: 'host-1', name: 'Host', points: 100, status: 'active', connected: true },
          { playerId: 'guest-1', name: 'Alex', points: 100, status: 'active', connected: true },
          { playerId: 'guest-2', name: 'Sam', points: 11, status: 'active', connected: true },
        ],
      }),
      localPlayerId: 'guest-2',
    });

    expect(panel).toMatchObject({ kind: 'form', background: 'vb-bg-bet', points: 11, maxBet: 5 });
  });

  it('lets a Bettor with exactly 1 Point bet 1 Point', () => {
    const panel = resolveBettingPanel({
      gameState: stateWith({
        players: [
          { playerId: 'host-1', name: 'Host', points: 100, status: 'active', connected: true },
          { playerId: 'guest-1', name: 'Alex', points: 100, status: 'active', connected: true },
          { playerId: 'guest-2', name: 'Sam', points: 1, status: 'active', connected: true },
        ],
      }),
      localPlayerId: 'guest-2',
    });

    expect(panel).toMatchObject({ kind: 'form', maxBet: 1 });
  });

  it.each([
    ['the Active Player', 'guest-1'],
    ['a Bettor who already placed a Bet', 'guest-2'],
  ])('uses the waiting background for %s', (_label, localPlayerId) => {
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

    expect(panel.background).toBe('vb-bg-wait');
  });

  it('shows a locked-in confirmation with the local Bet before the Host rebroadcast arrives', () => {
    const panel = resolveBettingPanel({
      gameState: stateWith(),
      localPlayerId: 'guest-2',
      localBet: { amount: 7, prediction: 'NO' },
    });

    expect(panel).toEqual({
      kind: 'locked',
      background: 'vb-bg-wait',
      ownBet: { amount: 7, prediction: 'NO' },
      waitingLabel: 'Waiting on 1 more player…',
      bettors: [
        { playerId: 'host-1', name: 'Host', hasBet: false, isLocalPlayer: false },
        { playerId: 'guest-2', name: 'Sam', hasBet: true, isLocalPlayer: true },
      ],
    });
  });

  it('counts how many Bettors have yet to bet once the Host has rebroadcast the local Bet', () => {
    const panel = resolveBettingPanel({
      gameState: stateWith({
        round: {
          activePlayerId: 'guest-1',
          challengeId: 'challenge-1',
          bets: [{ playerId: 'guest-2' }],
          outcome: null,
        },
      }),
      localPlayerId: 'guest-2',
      localBet: { amount: 3, prediction: 'YES' },
    });

    expect(panel).toMatchObject({ kind: 'locked', ownBet: { amount: 3, prediction: 'YES' }, waitingLabel: 'Waiting on 1 more player…' });
  });

  it('pluralises the waiting label for several Bettors who have yet to bet', () => {
    const gameState = stateWith({
      players: [
        { playerId: 'host-1', name: 'Host', points: 100, status: 'active', connected: true },
        { playerId: 'guest-1', name: 'Alex', points: 100, status: 'active', connected: true },
        { playerId: 'guest-2', name: 'Sam', points: 100, status: 'active', connected: true },
        { playerId: 'guest-3', name: 'Kim', points: 100, status: 'active', connected: true },
      ],
    });

    const panel = resolveBettingPanel({
      gameState,
      localPlayerId: 'guest-2',
      localBet: { amount: 3, prediction: 'YES' },
    });

    expect(panel).toMatchObject({ kind: 'locked', waitingLabel: 'Waiting on 2 more players…' });
  });

  it('is hidden on the waiting background when the local player is not yet known', () => {
    expect(resolveBettingPanel({ gameState: stateWith(), localPlayerId: null })).toEqual({
      kind: 'hidden',
      background: 'vb-bg-wait',
      bettors: [],
    });
  });

  it('shows the locked-in confirmation without a Bet when the local Bet is no longer known but the Host has recorded it', () => {
    const panel = resolveBettingPanel({
      gameState: stateWith({
        round: {
          activePlayerId: 'guest-1',
          challengeId: 'challenge-1',
          bets: [{ playerId: 'guest-2' }, { playerId: 'host-1' }],
          outcome: null,
        },
      }),
      localPlayerId: 'guest-2',
    });

    expect(panel).toMatchObject({ kind: 'locked', ownBet: null, waitingLabel: 'Everyone has bet.' });
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
