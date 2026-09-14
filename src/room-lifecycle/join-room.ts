import { GuestProtocol } from '../protocol/guest-protocol';
import { PeerUnavailableError, type Transport } from '../transport/transport';
import type { RoomRegistry } from './room-registry';

export type JoinResult =
  | { status: 'joined'; playerId: string; reconnectToken: string }
  | { status: 'invalid-room' }
  | { status: 'unreachable' }
  | { status: 'room-full' };

export type RejoinResult =
  | { status: 'joined'; playerId: string; reconnectToken: string }
  | { status: 'invalid-room' }
  | { status: 'unreachable' }
  | { status: 'unknown-player' };

/**
 * Shared Guest-side connect flow underlying `joinRoom`/`rejoinRoom`: derives `code`'s
 * Transport ID via `registry` (a pure, local computation — no shared lookup involved),
 * connects, sends via `send`, and awaits the Host's `welcome`/`rejected` reply — mapping a
 * `rejected` reply's reason via `onRejected`.
 */
function connectAndSend<Result extends { status: string }>(
  transport: Transport,
  registry: RoomRegistry,
  code: string,
  send: (protocol: GuestProtocol) => void,
  onRejected: (reason: string) => Result,
): Promise<Result | { status: 'joined'; playerId: string; reconnectToken: string } | { status: 'invalid-room' } | { status: 'unreachable' }> {
  const transportId = registry.transportIdFor(code);

  return new Promise((resolve) => {
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
}

/**
 * Guest-side join flow, for a Guest with no stored identity yet: sends `join` and awaits
 * the Host's `welcome`/`rejected` reply. Reports a clear, distinct result for an invalid
 * Room Code (no Host reachable under its derived id), an unreachable Host, and a full
 * Room, rather than leaving the caller to interpret a raw connection failure.
 */
export function joinRoom(transport: Transport, registry: RoomRegistry, code: string, name: string): Promise<JoinResult> {
  return connectAndSend(
    transport,
    registry,
    code,
    (protocol) => protocol.join({ name }),
    (reason) => (reason === 'ROOM_FULL' ? { status: 'room-full' } : { status: 'invalid-room' }),
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
export function rejoinRoom(transport: Transport, registry: RoomRegistry, code: string, reconnectToken: string): Promise<RejoinResult> {
  return connectAndSend(
    transport,
    registry,
    code,
    (protocol) => protocol.rejoin({ reconnectToken }),
    () => ({ status: 'unknown-player' }),
  );
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
