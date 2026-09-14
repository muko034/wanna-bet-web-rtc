import type { Transport } from '../transport/transport';
import {
  parseHostToGuestMessage,
  type HostToGuestMessage,
  type PlaceBetMessage,
} from './messages';

type HostToGuestType = HostToGuestMessage['type'];
type PayloadOf<T extends HostToGuestType> = Extract<HostToGuestMessage, { type: T }>['payload'];
type Handler<T extends HostToGuestType> = (payload: PayloadOf<T>, seq: number) => void;

/**
 * Guest-side typed dispatch and send helpers over `Transport` for the Host↔Guest wire
 * protocol. Parses every incoming payload against the Host→Guest catalog and dispatches to
 * whichever handler was registered for its `type`; unrecognized/malformed payloads are
 * logged and dropped, never reaching a handler.
 *
 * Exposes each dispatched message's `seq` to the handler but takes no action based on its
 * value — no reordering, de-duplication, or staleness check.
 */
export class GuestProtocol {
  private readonly transport: Transport;
  private readonly handlers = new Map<HostToGuestType, Handler<HostToGuestType>>();

  constructor(transport: Transport) {
    this.transport = transport;
    this.transport.onMessage((message) => this.handleMessage(message));
  }

  /** Registers `handler` to be invoked with the typed payload and `seq` of every valid message of `type`. */
  on<T extends HostToGuestType>(type: T, handler: Handler<T>): void {
    this.handlers.set(type, handler as unknown as Handler<HostToGuestType>);
  }

  /** Sends a `join` message to the Host. */
  join(payload: { name: string }): void {
    this.transport.send({ type: 'join', payload });
  }

  /** Sends a `rejoin` message to the Host. */
  rejoin(payload: { reconnectToken: string }): void {
    this.transport.send({ type: 'rejoin', payload });
  }

  /** Sends a `placeBet` message to the Host. */
  placeBet(payload: PlaceBetMessage['payload']): void {
    this.transport.send({ type: 'placeBet', payload });
  }

  /** Sends a `leave` message to the Host. */
  leave(): void {
    this.transport.send({ type: 'leave', payload: {} });
  }

  private handleMessage(message: unknown): void {
    const parsed = parseHostToGuestMessage(message);
    if (!parsed) {
      console.warn('GuestProtocol: dropped unrecognized or malformed message', message);
      return;
    }
    const handler = this.handlers.get(parsed.type);
    handler?.(parsed.payload, parsed.seq);
  }
}
