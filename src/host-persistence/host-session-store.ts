import type { GameState } from '../protocol/messages';
import type { Room } from '../room-lifecycle/room';
import type { RoundEngineState } from '../round-engine/round-engine';

/**
 * Everything the Host needs to pick an in-progress game back up after a reload: the broadcast
 * `GameState`, plus the Host-private state that never goes over the wire — the Room itself,
 * the Round Engine's unredacted Bets, the rotation flag, and which `reconnectToken` belongs to
 * which player, so returning Guests can `rejoin` as themselves.
 */
export type HostSession = {
  room: Room;
  gameState: GameState;
  roundEngineState: RoundEngineState;
  firstRoundStarted: boolean;
  /** `reconnectToken` → `playerId`. */
  reconnectTokens: Record<string, string>;
};

export type HostSessionSnapshot = {
  schemaVersion: number;
  savedAt: number;
  state: HostSession;
};

export const HOST_SESSION_SCHEMA_VERSION = 1;

const KEY_PREFIX = 'wanna-bet:host-session:';

function hostSessionKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && key.startsWith(KEY_PREFIX)) {
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Persists the Host's `session` in `storage` (the browser's own `localStorage` in production),
 * keyed by its Room Code, dropping any other Room's saved session so only the most recent one
 * is kept. Best-effort: a failed write (e.g. storage full or disabled) is swallowed, since
 * losing a save must never interrupt the game in progress.
 */
export function saveHostSession(storage: Storage, session: HostSession, now: number = Date.now()): void {
  const snapshot: HostSessionSnapshot = { schemaVersion: HOST_SESSION_SCHEMA_VERSION, savedAt: now, state: session };
  const key = KEY_PREFIX + session.room.code;
  try {
    for (const staleKey of hostSessionKeys(storage).filter((k) => k !== key)) {
      storage.removeItem(staleKey);
    }
    storage.setItem(key, JSON.stringify(snapshot));
  } catch (error) {
    console.warn('host-session-store: failed to save the Host session', error);
  }
}

function readSnapshot(storage: Storage, key: string): HostSessionSnapshot | null {
  const raw = storage.getItem(key);
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw) as HostSessionSnapshot;
  } catch {
    return null;
  }
}

/** Reads back the session `saveHostSession` stored for `code`'s Room, or `null` if there is none. */
export function loadHostSession(storage: Storage, code: string): HostSession | null {
  return readSnapshot(storage, KEY_PREFIX + code)?.state ?? null;
}

/**
 * The most recently saved session across every Room this device has hosted, or `null` — what
 * reopening the app offers to resume.
 */
export function findLatestHostSession(storage: Storage): HostSession | null {
  let latest: HostSessionSnapshot | null = null;
  for (const key of hostSessionKeys(storage)) {
    const snapshot = readSnapshot(storage, key);
    if (snapshot && (latest === null || snapshot.savedAt > latest.savedAt)) {
      latest = snapshot;
    }
  }
  return latest?.state ?? null;
}
