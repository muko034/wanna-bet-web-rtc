import type { Transport } from '../transport/transport';
import {
  parseGuestToHostMessage,
  type GuestToHostMessage,
  type RejectedMessage,
  type StateMessage,
  type WelcomeMessage,
} from './messages';

type GuestToHostType = GuestToHostMessage['type'];
type PayloadOf<T extends GuestToHostType> = Extract<GuestToHostMessage, { type: T }>['payload'];
type Handler<T extends GuestToHostType> = (payload: PayloadOf<T>, peerId: string) => void;

/**
 * Host-side typed dispatch and send helpers over `Transport` for the Host↔Guest wire
 * protocol. Parses every incoming payload against the Guest→Host catalog and dispatches to
 * whichever handler was registered for its `type`; unrecognized/malformed payloads are
 * logged and dropped, never reaching a handler.
 *
 * Owns `seq` stamping for every outgoing message: a single monotonically increasing
 * counter, incremented on every send regardless of whether it was targeted or broadcast.
 */
export class HostProtocol {
  private readonly transport: Transport;
  private readonly handlers = new Map<GuestToHostType, Handler<GuestToHostType>>();
  private seq = 0;

  constructor(transport: Transport) {
    this.transport = transport;
    this.transport.onMessage((message, peerId) => this.handleMessage(message, peerId));
  }

  /** Registers `handler` to be invoked with the typed payload of every valid message of `type`. */
  on<T extends GuestToHostType>(type: T, handler: Handler<T>): void {
    this.handlers.set(type, handler as unknown as Handler<GuestToHostType>);
  }

  /** Sends a `welcome` message to only `peerId`. */
  welcome(peerId: string, payload: WelcomeMessage['payload']): void {
    this.transport.send({ type: 'welcome', seq: this.nextSeq(), payload }, peerId);
  }

  /** Sends a `rejected` message to only `peerId`. */
  rejected(peerId: string, payload: RejectedMessage['payload']): void {
    this.transport.send({ type: 'rejected', seq: this.nextSeq(), payload }, peerId);
  }

  /** Broadcasts a `state` message to every connected Guest. */
  broadcastState(payload: StateMessage['payload']): void {
    this.transport.send({ type: 'state', seq: this.nextSeq(), payload });
  }

  private handleMessage(message: unknown, peerId: string): void {
    const parsed = parseGuestToHostMessage(message);
    if (!parsed) {
      console.warn('HostProtocol: dropped unrecognized or malformed message', message);
      return;
    }
    const handler = this.handlers.get(parsed.type);
    handler?.(parsed.payload, peerId);
  }

  private nextSeq(): number {
    return this.seq++;
  }
}
