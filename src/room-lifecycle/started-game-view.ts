import type { Room } from './room';

export type StartedGameView =
  | { view: 'started'; roomCode: string }
  | { view: 'redirect-to-lobby' }
  | { view: 'not-found' }
  | { view: 'join-form' }
  | { view: 'reconnecting'; roomCode: string }
  | { view: 'reconnect-failed'; roomCode: string; message: string };

/**
 * This device's own in-flight/settled attempt to rejoin `code` via its stored identity (see
 * `guest-reconnect.ts`'s `attemptReconnect`) — `null` when no such attempt applies, either
 * because this device has no stored identity for `code` or because it hasn't started one
 * yet. Driven identically by a page reload and by a detected connection drop — there is no
 * separate terminal "session ended" state for a Guest-side dropped connection; a drop always
 * resolves through this same automatic-retry-then-manual-fallback phase.
 */
export type ReconnectPhase = 'pending' | 'unknown-player' | { kind: 'error'; message: string } | null;

type Params = {
  /** The `:code` route param at `/room/<code>/play`. */
  code: string | undefined;
  /** This device's own Room, if it is the Host — `null` on a Guest's device. */
  room: Room | null;
  /**
   * The Room Code for which this Guest has locally observed the Host's `state` broadcast
   * with `status: 'active'` (via `watchForGameStart`) — `null` if this device hasn't seen
   * one, including on the Host's own device (which uses `room.started` instead).
   */
  guestGameStartedCode: string | null;
  /** Whether this device holds a stored identity (`playerId`/`reconnectToken`) for `code`. */
  hasStoredIdentity: boolean;
  reconnectPhase: ReconnectPhase;
};

/**
 * Decides what `/room/<code>/play` should show, for either role: the Host (whose own
 * `Room` object is authoritative), a Guest who has already resolved a live connection (via
 * `guestGameStartedCode`), or a Guest whose device just mounted this route with no live
 * signal yet — who drives the shared reconnect implementation in place, rather than bouncing
 * through the Lobby route or a "Page not found" dead end.
 */
export function resolveStartedGameView({ code, room, guestGameStartedCode, hasStoredIdentity, reconnectPhase }: Params): StartedGameView {
  if (code === undefined) {
    return { view: 'not-found' };
  }

  if (room !== null && room.code === code) {
    return room.started ? { view: 'started', roomCode: room.code } : { view: 'redirect-to-lobby' };
  }

  if (guestGameStartedCode === code) {
    return { view: 'started', roomCode: code };
  }

  if (!hasStoredIdentity || reconnectPhase === 'unknown-player') {
    return { view: 'join-form' };
  }

  if (reconnectPhase !== null && typeof reconnectPhase === 'object') {
    return { view: 'reconnect-failed', roomCode: code, message: reconnectPhase.message };
  }

  return { view: 'reconnecting', roomCode: code };
}
