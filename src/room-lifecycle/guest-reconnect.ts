import { GuestProtocol } from '../protocol/guest-protocol';
import type { GameState, PlaceBetPayload } from '../protocol/messages';
import type { Transport } from '../transport/transport';
import { rejoinRoom, watchForGameStart, watchForSessionEnd, watchGameState } from './join-room';
import { loadIdentity, saveIdentity } from './player-identity';
import type { RoomRegistry } from './room-registry';

export type ReconnectResult =
  | { status: 'no-identity' }
  | { status: 'joined'; playerId: string }
  | { status: 'unknown-player' }
  | { status: 'invalid-room' }
  | { status: 'unreachable' };

export type ReconnectCallbacks = {
  onGameState: (state: GameState) => void;
  /** This Guest's own live connection observed the Host's game-started broadcast for `code`. */
  onGameStarted: (code: string) => void;
  onSessionEnded: () => void;
  onPlaceBetReady: (placeBet: ((payload: PlaceBetPayload) => void) | null) => void;
};

/**
 * Subscribes `callbacks` to `transport`'s game-state, session-end, and game-started signals.
 * Safe to call before the Host has confirmed this connection (even before `transport.connect`)
 * — attaching these watchers as early as possible, ahead of sending `join`/`rejoin`, matters
 * because the Host may broadcast a state resend (`resendInProgressState`) synchronously
 * alongside its `welcome` reply: a watcher registered only after that reply resolves could
 * miss it.
 */
export function wireGuestConnection(transport: Transport, code: string, callbacks: ReconnectCallbacks): void {
  watchGameState(transport, callbacks.onGameState);
  watchForSessionEnd(transport, callbacks.onSessionEnded);
  watchForGameStart(transport, () => callbacks.onGameStarted(code));
}

/**
 * Finishes wiring up a `transport` the Host has just confirmed (via `join` or `rejoin`):
 * persists the identity the Host returned and enables placing Bets over this connection.
 * Called once `wireGuestConnection` has already attached the passive watchers above.
 */
export function completeGuestConnection(
  transport: Transport,
  code: string,
  storage: Storage,
  playerId: string,
  reconnectToken: string,
  callbacks: ReconnectCallbacks,
): void {
  saveIdentity(storage, code, { playerId, reconnectToken });
  const protocol = new GuestProtocol(transport);
  callbacks.onPlaceBetReady((payload) => protocol.placeBet(payload));
}

/**
 * The one Guest-side reconnect sequence shared by every call site that resumes an existing
 * player (the Lobby's join screen and `/room/<code>/play` on a reload, and — once a
 * connection-drop detector exists — a dropped connection on either route): load this
 * device's stored identity for `code`, and if one exists, present its `reconnectToken` to
 * the Host and wire the resulting live connection up via `wireGuestConnection`. A Guest with
 * no stored identity resolves immediately as `no-identity`, without ever touching
 * `transport`, so a caller can fall back to the ordinary join form without an unnecessary
 * connection attempt.
 */
export function attemptReconnect(
  transport: Transport,
  registry: RoomRegistry,
  storage: Storage,
  code: string,
  callbacks: ReconnectCallbacks,
): Promise<ReconnectResult> {
  const stored = loadIdentity(storage, code);
  if (!stored) {
    return Promise.resolve({ status: 'no-identity' });
  }

  wireGuestConnection(transport, code, callbacks);

  return rejoinRoom(transport, registry, code, stored.reconnectToken).then((result) => {
    if (result.status === 'joined') {
      completeGuestConnection(transport, code, storage, result.playerId, result.reconnectToken, callbacks);
      return { status: 'joined', playerId: result.playerId };
    }
    if (result.status === 'unknown-player') {
      return { status: 'unknown-player' };
    }
    return { status: result.status };
  });
}
