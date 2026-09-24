import { describe, expect, it } from 'vitest';
import { FakeStorage } from '../fake-storage';
import { findLatestHostSession, loadHostSession, saveHostSession, type HostSession } from './host-session-store';

function sessionFor(code: string, hostPoints = 100): HostSession {
  return {
    room: {
      code,
      hostName: 'Host',
      hostPlayerId: 'host-1',
      players: [{ playerId: 'p1', name: 'Alex', connected: true }],
      playerCount: 2,
      started: true,
    },
    gameState: {
      roomId: code,
      status: 'active',
      activePlayerId: 'host-1',
      resolution: null,
      round: { activePlayerId: 'host-1', challengeId: '001', bets: [{ playerId: 'p1' }], outcome: null },
      players: [
        { playerId: 'host-1', name: 'Host', points: hostPoints, status: 'active', connected: true },
        { playerId: 'p1', name: 'Alex', points: 90, status: 'active', connected: true },
      ],
    },
    roundEngineState: {
      playerOrder: ['host-1', 'p1'],
      points: { 'host-1': hostPoints, p1: 90 },
      challengeHistory: ['001'],
      round: { activePlayerId: 'host-1', challengeId: '001', bets: [{ playerId: 'p1', amount: 10, prediction: 'YES' }], outcome: null },
    },
    firstRoundStarted: true,
    reconnectTokens: { 'token-1': 'p1' },
  };
}

describe('host-session-store', () => {
  it("round-trips the Host's full session — Game State, Round Engine state and reconnect tokens — keyed by Room Code", () => {
    const storage = new FakeStorage();
    const session = sessionFor('ABCDEF');

    saveHostSession(storage, session);

    expect(loadHostSession(storage, 'ABCDEF')).toEqual(session);
  });

  it('finds nothing to resume for a Room Code that was never saved', () => {
    const storage = new FakeStorage();
    saveHostSession(storage, sessionFor('ABCDEF'));

    expect(loadHostSession(storage, 'ZZZZZZ')).toBeNull();
  });

  it('finds the most recently saved session to offer for resuming, ignoring unrelated storage entries', () => {
    const storage = new FakeStorage();
    storage.setItem('wanna-bet:identity:QQQQQQ', JSON.stringify({ playerId: 'p9', reconnectToken: 't9' }));
    saveHostSession(storage, sessionFor('NEWER1', 80), 2_000);
    saveHostSession(storage, sessionFor('OLDER1', 70), 1_000);

    expect(findLatestHostSession(storage)).toEqual(sessionFor('NEWER1', 80));
  });

  it('finds nothing to resume when no session was ever saved', () => {
    expect(findLatestHostSession(new FakeStorage())).toBeNull();
  });
});
