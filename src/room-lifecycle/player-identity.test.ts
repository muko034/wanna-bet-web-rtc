import { describe, expect, it } from 'vitest';
import { FakeStorage } from '../fake-storage';
import { loadIdentity, saveIdentity } from './player-identity';

describe('player-identity', () => {
  it("round-trips a Guest's playerId and reconnectToken through storage, scoped to the Room they were assigned in", () => {
    const storage = new FakeStorage();

    saveIdentity(storage, 'ABCDEF', { playerId: 'p1', reconnectToken: 't1' });

    expect(loadIdentity(storage, 'ABCDEF')).toEqual({ playerId: 'p1', reconnectToken: 't1' });
  });

  it('returns null when no identity has been stored yet for that Room Code', () => {
    const storage = new FakeStorage();

    expect(loadIdentity(storage, 'NEVERJOINED')).toBeNull();
  });

  it("keeps identities for different Rooms independent, so joining a second Room doesn't clobber the first", () => {
    const storage = new FakeStorage();

    saveIdentity(storage, 'ROOM1', { playerId: 'p1', reconnectToken: 't1' });
    saveIdentity(storage, 'ROOM2', { playerId: 'p2', reconnectToken: 't2' });

    expect(loadIdentity(storage, 'ROOM1')).toEqual({ playerId: 'p1', reconnectToken: 't1' });
    expect(loadIdentity(storage, 'ROOM2')).toEqual({ playerId: 'p2', reconnectToken: 't2' });
  });
});
