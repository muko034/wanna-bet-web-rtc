import { describe, expect, it } from 'vitest';
import { FakeStorage } from '../fake-storage';
import { HOST_SESSION_SCHEMA_VERSION, TTL_MS, loadHostSession, saveHostSession, type HostSession } from './host-session-store';

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

  it("keeps each Room's session separately: saving one Room never overwrites or drops another's", () => {
    const storage = new FakeStorage();
    saveHostSession(storage, sessionFor('ROOM01', 70));
    saveHostSession(storage, sessionFor('ROOM02', 80));
    saveHostSession(storage, sessionFor('ROOM01', 75));

    expect(loadHostSession(storage, 'ROOM01')).toEqual(sessionFor('ROOM01', 75));
    expect(loadHostSession(storage, 'ROOM02')).toEqual(sessionFor('ROOM02', 80));
  });

  it("leaves other areas' storage entries untouched", () => {
    const storage = new FakeStorage();
    storage.setItem('wanna-bet:identity:QQQQQQ', JSON.stringify({ playerId: 'p9', reconnectToken: 't9' }));

    saveHostSession(storage, sessionFor('ABCDEF'));

    expect(storage.getItem('wanna-bet:identity:QQQQQQ')).toBe(JSON.stringify({ playerId: 'p9', reconnectToken: 't9' }));
  });

  it('finds nothing, rather than throwing, when storage is unavailable', () => {
    const storage = new FakeStorage();
    storage.getItem = () => {
      throw new Error('SecurityError: storage disabled');
    };

    expect(loadHostSession(storage, 'ABCDEF')).toBeNull();
  });

  it('treats a snapshot written by an incompatible schema version as no snapshot present, and discards it', () => {
    const storage = new FakeStorage();
    storage.setItem(
      'wanna-bet:host-session:ABCDEF',
      JSON.stringify({ schemaVersion: HOST_SESSION_SCHEMA_VERSION + 1, savedAt: Date.now(), ttl: Math.floor(Date.now() / 1000) + 1, state: sessionFor('ABCDEF') }),
    );

    expect(loadHostSession(storage, 'ABCDEF')).toBeNull();
    expect(storage.getItem('wanna-bet:host-session:ABCDEF')).toBeNull();
  });

  it('treats a stale (expired ttl) snapshot as no snapshot present, and discards it', () => {
    const storage = new FakeStorage();
    const savedAt = 1_000_000_000;
    saveHostSession(storage, sessionFor('ABCDEF'), savedAt);

    expect(loadHostSession(storage, 'ABCDEF', savedAt + TTL_MS + 1)).toBeNull();
    expect(storage.getItem('wanna-bet:host-session:ABCDEF')).toBeNull();
  });

  it("refreshes a snapshot's ttl from now on every save, not just the first", () => {
    const storage = new FakeStorage();
    const firstSave = 1_000_000_000;
    const secondSave = firstSave + TTL_MS - 3_600_000;
    saveHostSession(storage, sessionFor('ABCDEF'), firstSave);
    saveHostSession(storage, sessionFor('ABCDEF'), secondSave);

    // Past the first save's original ttl, but within TTL_MS of the second save's refreshed ttl.
    const afterOriginalTtl = firstSave + TTL_MS + 1;
    expect(loadHostSession(storage, 'ABCDEF', afterOriginalTtl)).not.toBeNull();
  });
});
