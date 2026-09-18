import { describe, expect, it } from 'vitest';
import {
  parseGuestToHostMessage,
  parseHostToGuestMessage,
  type GameState,
} from './messages';

const gameState: GameState = {
  roomId: 'ABCDEF',
  status: 'active',
  activePlayerId: null,
  resolution: null,
  players: [{ playerId: 'p1', name: 'Alex', points: 0, status: 'active', connected: true }],
  round: {
    activePlayerId: 'p1',
    challengeId: 'c1',
    bets: [{ playerId: 'p1' }],
    outcome: null,
  },
};

describe('parseGuestToHostMessage', () => {
  it('accepts a valid join message', () => {
    const message = { type: 'join', payload: { name: 'Alex' } };
    expect(parseGuestToHostMessage(message)).toEqual(message);
  });

  it('rejects a join message with a non-string name', () => {
    expect(parseGuestToHostMessage({ type: 'join', payload: { name: 42 } })).toBeUndefined();
  });

  it('accepts a valid rejoin message', () => {
    const message = { type: 'rejoin', payload: { reconnectToken: 'tok-1' } };
    expect(parseGuestToHostMessage(message)).toEqual(message);
  });

  it('rejects a rejoin message missing reconnectToken', () => {
    expect(parseGuestToHostMessage({ type: 'rejoin', payload: {} })).toBeUndefined();
  });

  it('accepts a valid placeBet message', () => {
    const message = { type: 'placeBet', payload: { amount: 10, prediction: 'YES' } };
    expect(parseGuestToHostMessage(message)).toEqual(message);
  });

  it('rejects a placeBet message with a non-numeric amount', () => {
    expect(
      parseGuestToHostMessage({ type: 'placeBet', payload: { amount: '10', prediction: 'YES' } }),
    ).toBeUndefined();
  });

  it('accepts a valid leave message', () => {
    const message = { type: 'leave', payload: {} };
    expect(parseGuestToHostMessage(message)).toEqual(message);
  });

  it('rejects a non-object input', () => {
    expect(parseGuestToHostMessage('not a message')).toBeUndefined();
    expect(parseGuestToHostMessage(null)).toBeUndefined();
    expect(parseGuestToHostMessage(undefined)).toBeUndefined();
  });

  it('rejects an object with an unrecognized type', () => {
    expect(parseGuestToHostMessage({ type: 'unknown', payload: {} })).toBeUndefined();
  });

  it('rejects a Host→Guest-only message type', () => {
    expect(
      parseGuestToHostMessage({ type: 'welcome', seq: 1, payload: { playerId: 'p1', reconnectToken: 't' } }),
    ).toBeUndefined();
  });
});

describe('parseHostToGuestMessage', () => {
  it('accepts a valid welcome message', () => {
    const message = { type: 'welcome', seq: 1, payload: { playerId: 'p1', reconnectToken: 'tok-1' } };
    expect(parseHostToGuestMessage(message)).toEqual(message);
  });

  it('rejects a welcome message missing seq', () => {
    expect(
      parseHostToGuestMessage({ type: 'welcome', payload: { playerId: 'p1', reconnectToken: 'tok-1' } }),
    ).toBeUndefined();
  });

  it('accepts a valid rejected message', () => {
    const message = { type: 'rejected', seq: 2, payload: { reason: 'ROOM_FULL', action: 'join' } };
    expect(parseHostToGuestMessage(message)).toEqual(message);
  });

  it('rejects a rejected message with a non-string reason', () => {
    expect(
      parseHostToGuestMessage({ type: 'rejected', seq: 2, payload: { reason: 1, action: 'join' } }),
    ).toBeUndefined();
  });

  it('accepts a valid state message', () => {
    const message = { type: 'state', seq: 3, payload: gameState };
    expect(parseHostToGuestMessage(message)).toEqual(message);
  });

  it('rejects a state message with a malformed payload', () => {
    expect(
      parseHostToGuestMessage({ type: 'state', seq: 3, payload: { ...gameState, status: 'bogus' } }),
    ).toBeUndefined();
  });

  it('accepts a state message carrying the next Active Player and a Resolution summary after a round closes', () => {
    const message = {
      type: 'state',
      seq: 4,
      payload: {
        ...gameState,
        activePlayerId: 'p2',
        round: null,
        resolution: {
          activePlayerId: 'p1',
          outcome: 'YES',
          payouts: [
            { playerId: 'p1', amount: 15 },
            { playerId: 'p2', amount: 20 },
            { playerId: 'p3', amount: -15 },
          ],
        },
      },
    } as const;

    expect(parseHostToGuestMessage(message)).toEqual(message);
  });

  it('rejects a non-object input', () => {
    expect(parseHostToGuestMessage(42)).toBeUndefined();
  });

  it('rejects an object with an unrecognized type', () => {
    expect(parseHostToGuestMessage({ type: 'unknown', seq: 1, payload: {} })).toBeUndefined();
  });

  it('rejects a Guest→Host-only message type', () => {
    expect(parseHostToGuestMessage({ type: 'join', payload: { name: 'Alex' } })).toBeUndefined();
  });
});
