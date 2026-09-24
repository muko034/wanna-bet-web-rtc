import type { GameState } from '../protocol/messages';
import type { Room } from '../room-lifecycle/room';
import type { RoundEngineState } from '../round-engine/round-engine';

/**
 * Everything the Host needs to pick a Room back up after a reload, Lobby or game: the broadcast
 * `GameState`, plus the Host-private state that never goes over the wire — the Room itself,
 * the Round Engine's unredacted Bets, the rotation flag, and which `reconnectToken` belongs to
 * which player, so returning Guests can `rejoin` as themselves.
 */
export type HostSession = {
  room: Room;
  gameState: GameState;
  /** `null` while the Room is still in the Lobby. */
  roundEngineState: RoundEngineState | null;
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

/**
 * Persists the Host's `session` in `storage` (the browser's own `localStorage` in production),
 * keyed by its Room Code, so every Room hosted on this device keeps its own session. Best-effort: a failed write (e.g. storage full or disabled) is swallowed, since
 * losing a save must never interrupt the game in progress.
 */
export function saveHostSession(storage: Storage, session: HostSession, now: number = Date.now()): void {
  const snapshot: HostSessionSnapshot = { schemaVersion: HOST_SESSION_SCHEMA_VERSION, savedAt: now, state: session };
  try {
    storage.setItem(KEY_PREFIX + session.room.code, JSON.stringify(snapshot));
  } catch (error) {
    console.warn('host-session-store: failed to save the Host session', error);
  }
}

/**
 * Reads back the session `saveHostSession` stored for `code`'s Room, or `null` if there is none.
 * Best-effort like saving: unreadable storage or a corrupt entry also reads as no session.
 */
export function loadHostSession(storage: Storage, code: string): HostSession | null {
  try {
    const raw = storage.getItem(KEY_PREFIX + code);
    return raw === null ? null : (JSON.parse(raw) as HostSessionSnapshot).state;
  } catch {
    return null;
  }
}
