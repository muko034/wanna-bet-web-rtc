import { describe, expect, it, vi } from 'vitest';
import { FakeStorage } from '../fake-storage';
import { FakeTransport } from '../transport/fake-transport';
import { forgetRemovedGuest } from './guest-leave';
import { loadIdentity, saveIdentity } from './player-identity';

describe('forgetRemovedGuest', () => {
  it('deletes the identity of the Room, so a reload does not resume it, and closes the connection', () => {
    const storage = new FakeStorage();
    saveIdentity(storage, 'ABCDEF', { playerId: 'p1', reconnectToken: 'token' });
    saveIdentity(storage, 'GHJKLM', { playerId: 'p2', reconnectToken: 'other' });
    const transport = new FakeTransport();
    const close = vi.spyOn(transport, 'close');

    forgetRemovedGuest(transport, storage, 'ABCDEF');

    expect(loadIdentity(storage, 'ABCDEF')).toBeNull();
    expect(loadIdentity(storage, 'GHJKLM')).not.toBeNull();
    expect(close).toHaveBeenCalledOnce();
  });

  it('still deletes the identity when there is no connection left to close', () => {
    const storage = new FakeStorage();
    saveIdentity(storage, 'ABCDEF', { playerId: 'p1', reconnectToken: 'token' });

    forgetRemovedGuest(null, storage, 'ABCDEF');

    expect(loadIdentity(storage, 'ABCDEF')).toBeNull();
  });
});
