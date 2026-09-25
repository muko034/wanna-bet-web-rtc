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
  /** Absolute expiry timestamp — set to `savedAt + TTL_MS` on every save, not just the first. */
  ttl: number;
  state: HostSession;
};

export const HOST_SESSION_SCHEMA_VERSION = 1;

/** How long a snapshot stays resumable after its most recent save before it's considered stale. */
const TTL_MS = 24 * 60 * 60 * 1000;

const KEY_PREFIX = 'wanna-bet:host-session:';

/**
 * Persists the Host's `session` in `storage` (the browser's own `localStorage` in production),
 * keyed by its Room Code, so every Room hosted on this device keeps its own session. Best-effort: a failed write (e.g. storage full or disabled) is swallowed, since
 * losing a save must never interrupt the game in progress. Every save refreshes the snapshot's
 * `ttl` to `now + 24h`, not just the first.
 */
export function saveHostSession(storage: Storage, session: HostSession, now: number = Date.now()): void {
  const snapshot: HostSessionSnapshot = { schemaVersion: HOST_SESSION_SCHEMA_VERSION, savedAt: now, ttl: now + TTL_MS, state: session };
  try {
    storage.setItem(KEY_PREFIX + session.room.code, JSON.stringify(snapshot));
  } catch (error) {
    console.warn('host-session-store: failed to save the Host session', error);
  }
}

/**
 * Reads back the session `saveHostSession` stored for `code`'s Room, or `null` if there is none.
 * Best-effort like saving: unreadable storage or a corrupt entry also reads as no session. A
 * snapshot written by a different `schemaVersion`, or whose `ttl` has passed `now`, is treated
 * the same as no snapshot present, never partially applied.
 */
export function loadHostSession(storage: Storage, code: string, now: number = Date.now()): HostSession | null {
  try {
    const raw = storage.getItem(KEY_PREFIX + code);
    if (raw === null) return null;
    const snapshot = JSON.parse(raw) as HostSessionSnapshot;
    if (snapshot.schemaVersion !== HOST_SESSION_SCHEMA_VERSION) return null;
    if (snapshot.ttl <= now) return null;
    return snapshot.state;
  } catch {
    return null;
  }
}
