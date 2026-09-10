import { PeerUnavailableError, type Transport } from '../transport/transport';
import type { RoomRegistry } from './room-registry';

export type JoinResult =
  | { status: 'joined'; playerId: string; reconnectToken: string }
  | { status: 'invalid-room' }
  | { status: 'unreachable' }
  | { status: 'room-full' };

type WelcomeMessage = { type: 'welcome'; payload: { playerId: string; reconnectToken: string } };
type RejectedMessage = { type: 'rejected'; payload: { reason: string; action: string } };

function isWelcomeMessage(message: unknown): message is WelcomeMessage {
  return typeof message === 'object' && message !== null && (message as { type?: unknown }).type === 'welcome';
}

function isRejectedMessage(message: unknown): message is RejectedMessage {
  return typeof message === 'object' && message !== null && (message as { type?: unknown }).type === 'rejected';
}

/**
 * Guest-side join flow: derives `code`'s Transport ID via `registry` (a pure, local
 * computation — no shared lookup involved, see ADR 0001), connects, sends `join`, and
 * awaits the Host's `welcome`/`rejected` reply. Reports a clear, distinct result for an
 * invalid Room Code (no Host reachable under its derived id), an unreachable Host, and a
 * full Room, rather than leaving the caller to interpret a raw connection failure.
 */
export function joinRoom(transport: Transport, registry: RoomRegistry, code: string, name: string): Promise<JoinResult> {
  const transportId = registry.transportIdFor(code);

  return new Promise((resolve) => {
    transport
      .connect(transportId)
      .then(() => {
        transport.onMessage((message) => {
          if (isWelcomeMessage(message)) {
            resolve({ status: 'joined', playerId: message.payload.playerId, reconnectToken: message.payload.reconnectToken });
          } else if (isRejectedMessage(message)) {
            resolve(message.payload.reason === 'ROOM_FULL' ? { status: 'room-full' } : { status: 'invalid-room' });
          }
        });
        transport.send({ type: 'join', payload: { name } });
      })
      .catch((error) => resolve({ status: error instanceof PeerUnavailableError ? 'invalid-room' : 'unreachable' }));
  });
}
