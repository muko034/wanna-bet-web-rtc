import { GuestProtocol } from '../protocol/guest-protocol';
import type { GameState } from '../protocol/messages';
import { PeerUnavailableError, type Transport } from '../transport/transport';
import type { RoomRegistry } from './room-registry';

export type JoinResult =
  | { status: 'joined'; playerId: string; reconnectToken: string }
  | { status: 'invalid-room' }
  | { status: 'unreachable' }
  | { status: 'room-full' }
  | { status: 'game-started' };

export type RejoinResult =
  | { status: 'joined'; playerId: string; reconnectToken: string }
  | { status: 'invalid-room' }
  | { status: 'unreachable' }
  | { status: 'unknown-player' };

/**
 * How long `connectAndSend` waits for `transport.connect()` to settle before treating the
 * Host as unreachable. A real WebRTC connection attempt that gets no response at all (the
 * Host is gone without cleanly deregistering, a network partition) never rejects on its
 * own — there is no PeerJS error event for "nothing answered" — so without this timeout the
 * returned promise would hang forever instead of resolving `unreachable`.
 */
const CONNECT_TIMEOUT_MS = 8_000;

function afterTimeout(ms: number): Promise<'timed-out'> {
  return new Promise((resolve) => setTimeout(() => resolve('timed-out'), ms));
}

/**
 * Shared Guest-side connect flow underlying `joinRoom`/`rejoinRoom`: derives `code`'s
 * Transport ID via `registry` (a pure, local computation — no shared lookup involved),
 * connects, sends via `send`, and awaits the Host's `welcome`/`rejected` reply — mapping a
 * `rejected` reply's reason via `onRejected`. Races the connect attempt against `timeout`,
 * resolving `unreachable` if nothing (success or error) comes back within `CONNECT_TIMEOUT_MS`.
 */
function connectAndSend<Result extends { status: string }>(
  transport: Transport,
  registry: RoomRegistry,
  code: string,
  send: (protocol: GuestProtocol) => void,
  onRejected: (reason: string) => Result,
  timeout: (ms: number) => Promise<'timed-out'> = afterTimeout,
): Promise<Result | { status: 'joined'; playerId: string; reconnectToken: string } | { status: 'invalid-room' } | { status: 'unreachable' }> {
  const transportId = registry.transportIdFor(code);

  const connectAttempt = new Promise<Result | { status: 'joined'; playerId: string; reconnectToken: string } | { status: 'invalid-room' } | { status: 'unreachable' }>((resolve) => {
    transport
      .connect(transportId)
      .then(() => {
        const protocol = new GuestProtocol(transport);
        protocol.on('welcome', (payload) => {
          resolve({ status: 'joined', playerId: payload.playerId, reconnectToken: payload.reconnectToken });
        });
        protocol.on('rejected', (payload) => {
          resolve(onRejected(payload.reason));
        });
        send(protocol);
      })
      .catch((error) => resolve({ status: error instanceof PeerUnavailableError ? 'invalid-room' : 'unreachable' }));
  });

  return Promise.race([connectAttempt, timeout(CONNECT_TIMEOUT_MS).then((): { status: 'unreachable' } => ({ status: 'unreachable' }))]);
}

/**
 * Guest-side join flow, for a Guest with no stored identity yet: sends `join` and awaits
 * the Host's `welcome`/`rejected` reply. Reports a clear, distinct result for an invalid
 * Room Code (no Host reachable under its derived id), an unreachable Host, and a full
 * Room, rather than leaving the caller to interpret a raw connection failure.
 */
export function joinRoom(
  transport: Transport,
  registry: RoomRegistry,
  code: string,
  name: string,
  timeout: (ms: number) => Promise<'timed-out'> = afterTimeout,
): Promise<JoinResult> {
  return connectAndSend(
    transport,
    registry,
    code,
    (protocol) => protocol.join({ name }),
    (reason) => (
      reason === 'ROOM_FULL' ? { status: 'room-full' } :
      reason === 'GAME_STARTED' ? { status: 'game-started' } :
      { status: 'invalid-room' }
    ),
    timeout,
  );
}

/**
 * Guest-side rejoin flow, for a Guest presenting a `reconnectToken` stored from a prior
 * session (a dropped connection or page reload): sends `rejoin` instead of `join`, so the
 * Host matches it back to the existing player record rather than creating a new one. A
 * `reconnectToken` the Host no longer recognizes resolves as `unknown-player`, distinct
 * from an invalid Room Code, so the caller can fall back to a fresh `joinRoom` instead of
 * showing a "Room doesn't exist" message.
 */
export function rejoinRoom(
  transport: Transport,
  registry: RoomRegistry,
  code: string,
  reconnectToken: string,
  timeout: (ms: number) => Promise<'timed-out'> = afterTimeout,
): Promise<RejoinResult> {
  return connectAndSend(
    transport,
    registry,
    code,
    (protocol) => protocol.rejoin({ reconnectToken }),
    () => ({ status: 'unknown-player' }),
    timeout,
  );
}

/**
 * Watches a Guest's own `transport` for a `state` message announcing the game has started
 * (`status: 'active'`). This is the Guest's only cue to leave the "waiting for the Host to
 * start" screen — there is no separate "game started" message, just the first `state`
 * broadcast, since Round Engine state itself carries no earlier status a Guest could act on.
 */
export function watchForGameStart(transport: Transport, onGameStarted: () => void): void {
  const protocol = new GuestProtocol(transport);
  protocol.on('state', (payload) => {
    if (payload.status === 'active') {
      onGameStarted();
    }
  });
}

export function watchGameState(transport: Transport, onGameState: (state: GameState) => void): void {
  const protocol = new GuestProtocol(transport);
  protocol.on('state', (payload) => onGameState(payload));
}

/**
 * Watches a Guest's own `transport` for its connection to the Host being lost. A dropped
 * data channel is terminal here — this app never attempts an automatic reconnect — so a
 * single `connected: false` notification is enough to call the Room over. There is no Host
 * migration; `onSessionEnded` is the caller's cue to show a clear "session ended" state
 * instead of leaving the Guest stuck on a stale screen.
 */
export function watchForSessionEnd(transport: Transport, onSessionEnded: () => void): void {
  transport.onConnectionChange((_peerId, connected) => {
    if (!connected) {
      onSessionEnded();
    }
  });
}
