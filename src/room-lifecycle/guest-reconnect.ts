import { GuestProtocol } from '../protocol/guest-protocol';
import type { GameState, PlaceBetPayload } from '../protocol/messages';
import type { Transport } from '../transport/transport';
import { rejoinRoom, watchForConnectionDrop, watchForGameStart, watchGameState } from './join-room';
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
  /**
   * This Guest's live connection to the Host was lost. There is no way to tell a brief drop
   * apart from the Host being gone for good at this moment, so both are reported the same
   * way — the caller's job is to drive the shared reconnect implementation automatically in
   * response, not to treat this as a terminal state.
   */
  onConnectionDropped: () => void;
  onPlaceBetReady: (placeBet: ((payload: PlaceBetPayload) => void) | null) => void;
};

/** Total `rejoin` attempts (the first try plus these retries) before giving up as `unreachable`. */
const RECONNECT_RETRY_ATTEMPTS = 3;
/** Delay between automatic retry attempts — short enough that a brief blip resolves without the Guest noticing. */
const RECONNECT_RETRY_DELAY_MS = 1_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  watchForConnectionDrop(transport, callbacks.onConnectionDropped);
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
 * player (the Lobby's join screen and `/room/<code>/play`, both on a reload and when either
 * route's own connection-drop detector fires — see `wireGuestConnection`'s
 * `onConnectionDropped`): load this device's stored identity for `code`, and if one exists,
 * present its `reconnectToken` to the Host and wire the resulting live connection up via
 * `wireGuestConnection`. A Guest with
 * no stored identity resolves immediately as `no-identity`, without ever touching
 * `transport`, so a caller can fall back to the ordinary join form without an unnecessary
 * connection attempt.
 *
 * Retries a `rejoin` attempt that gets no response at all from the Host (`unreachable` —
 * the Host is briefly unreachable, a slow network) automatically, up to
 * `RECONNECT_RETRY_ATTEMPTS` tries total with `RECONNECT_RETRY_DELAY_MS` between them,
 * before resolving `unreachable` for the caller to show a manual-Retry state. An explicit
 * rejection from the Host (`unknown-player`, or a definite `invalid-room` answer) is never
 * retried — retrying an answer the Host already gave can't change the outcome. `wait` is
 * injectable so tests can assert the retry delay without real timers (see `reopenRoom` in
 * `room.ts` for the same pattern).
 */
export async function attemptReconnect(
  transport: Transport,
  registry: RoomRegistry,
  storage: Storage,
  code: string,
  callbacks: ReconnectCallbacks,
  wait: (ms: number) => Promise<void> = delay,
): Promise<ReconnectResult> {
  const stored = loadIdentity(storage, code);
  if (!stored) {
    return { status: 'no-identity' };
  }

  wireGuestConnection(transport, code, callbacks);

  for (let attempt = 1; ; attempt++) {
    const result = await rejoinRoom(transport, registry, code, stored.reconnectToken);

    if (result.status === 'joined') {
      completeGuestConnection(transport, code, storage, result.playerId, result.reconnectToken, callbacks);
      return { status: 'joined', playerId: result.playerId };
    }
    if (result.status !== 'unreachable' || attempt >= RECONNECT_RETRY_ATTEMPTS) {
      return { status: result.status };
    }
    await wait(RECONNECT_RETRY_DELAY_MS);
  }
}
