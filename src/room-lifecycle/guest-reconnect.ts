import { GuestProtocol } from '../protocol/guest-protocol';
import type { GameState, PlaceBetPayload } from '../protocol/messages';
import type { Transport } from '../transport/transport';
import { rejoinRoom, watchForBetRejection, watchForConnectionDrop, watchForGameStart, watchForHostSilence, watchGameState } from './join-room';
import { loadIdentity, saveIdentity } from './player-identity';
import type { RoomRegistry } from './room-registry';
import type { BetRejection } from '../round-engine/round-engine';

export type ReconnectResult =
  | { status: 'no-identity' }
  | { status: 'joined'; playerId: string }
  | { status: 'unknown-player' }
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
  /** The Host explicitly refused this Guest's Bet, for the given reason code. */
  onBetRejected: (reason: BetRejection) => void;
};

/** Delay before the first automatic retry attempt. */
const RECONNECT_INITIAL_DELAY_MS = 2_000;
/** Per-attempt delay cap — `RECONNECT_INITIAL_DELAY_MS` doubles on every retry up to this ceiling. */
const RECONNECT_MAX_DELAY_MS = 20_000;
/** Total retry time before giving up as `unreachable`; sized for a Host app-switch or locked screen, not just a network blip. */
const RECONNECT_MAX_DURATION_MS = 5 * 60_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Subscribes `callbacks` to `transport`'s game-state, connection-loss (a reported drop or a silent Host), game-started and Bet-rejection signals.
 * Safe to call before the Host has confirmed this connection (even before `transport.connect`)
 * — attaching these watchers as early as possible, ahead of sending `join`/`rejoin`, matters
 * because the Host may broadcast a state resend (`resendInProgressState`) synchronously
 * alongside its `welcome` reply: a watcher registered only after that reply resolves could
 * miss it. Returns the Host-silence watcher's `arm`, to be called once the Host confirms the
 * connection (see `completeGuestConnection`) — not at wiring, which may precede a slow join or a
 * long rejoin retry.
 */
export function wireGuestConnection(transport: Transport, code: string, callbacks: ReconnectCallbacks): () => void {
  watchGameState(transport, callbacks.onGameState);
  watchForConnectionDrop(transport, callbacks.onConnectionDropped);
  const armHostSilence = watchForHostSilence(transport, callbacks.onConnectionDropped);
  watchForGameStart(transport, () => callbacks.onGameStarted(code));
  watchForBetRejection(transport, callbacks.onBetRejected);
  return armHostSilence;
}

/**
 * Finishes wiring up a `transport` the Host has just confirmed (via `join` or `rejoin`):
 * persists the identity the Host returned, enables placing Bets over this connection, and
 * starts the Host-silence countdown via `armHostSilence`.
 * Called once `wireGuestConnection` has already attached the passive watchers above.
 */
export function completeGuestConnection(
  transport: Transport,
  code: string,
  storage: Storage,
  playerId: string,
  reconnectToken: string,
  callbacks: ReconnectCallbacks,
  armHostSilence: () => void,
): void {
  saveIdentity(storage, code, { playerId, reconnectToken });
  const protocol = new GuestProtocol(transport);
  callbacks.onPlaceBetReady((payload) => protocol.placeBet(payload));
  armHostSilence();
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
 * Retries a `rejoin` attempt that finds no Host — no response at all, or no Host registered
 * under the Room Code (`unreachable` / `invalid-room` from `rejoinRoom`) — automatically for up
 * to `RECONNECT_MAX_DURATION_MS`, waiting `RECONNECT_INITIAL_DELAY_MS` before the first retry and
 * doubling that delay after each further failure up to `RECONNECT_MAX_DELAY_MS`, before resolving
 * `unreachable` for the caller to show a manual-Retry state. A stored identity proves
 * the Room existed, so a missing Host is treated as the Host being briefly away (e.g. it
 * navigated off and is about to come back), never as a Room that doesn't exist. Only an explicit
 * `unknown-player` rejection from the Host is never retried — retrying an answer the Host
 * already gave can't change the outcome. `wait` is injectable so tests can assert the retry
 * delay without real timers (see `reopenRoom` in
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

  const armHostSilence = wireGuestConnection(transport, code, callbacks);

  let waitedMs = 0;
  let delayMs = RECONNECT_INITIAL_DELAY_MS;
  for (;;) {
    const result = await rejoinRoom(transport, registry, code, stored.reconnectToken);

    if (result.status === 'joined') {
      completeGuestConnection(transport, code, storage, result.playerId, result.reconnectToken, callbacks, armHostSilence);
      return { status: 'joined', playerId: result.playerId };
    }
    if (result.status === 'unknown-player') {
      return { status: 'unknown-player' };
    }
    if (waitedMs >= RECONNECT_MAX_DURATION_MS) {
      return { status: 'unreachable' };
    }
    await wait(delayMs);
    waitedMs += delayMs;
    delayMs = Math.min(delayMs * 2, RECONNECT_MAX_DELAY_MS);
  }
}
