export type StoredIdentity = { playerId: string; reconnectToken: string };

const KEY_PREFIX = 'wanna-bet:identity:';

/**
 * Persists a Guest's `playerId`/`reconnectToken` for `code`'s Room in `storage` (the
 * browser's own `localStorage` in production), scoped per Room Code so identities for
 * different Rooms this device has joined don't overwrite each other.
 */
export function saveIdentity(storage: Storage, code: string, identity: StoredIdentity): void {
  storage.setItem(KEY_PREFIX + code, JSON.stringify(identity));
}

/** Reads back the identity `saveIdentity` stored for `code`'s Room, or `null` if none exists yet. */
export function loadIdentity(storage: Storage, code: string): StoredIdentity | null {
  const raw = storage.getItem(KEY_PREFIX + code);
  return raw === null ? null : (JSON.parse(raw) as StoredIdentity);
}
