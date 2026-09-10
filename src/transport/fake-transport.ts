import type { Transport } from './transport';
import { PeerUnavailableError, RequestedIdTakenError } from './transport';

type MessageHandler = (message: unknown, peerId: string) => void;
type ConnectionChangeHandler = (peerId: string, connected: boolean) => void;

let nextId = 1;

// In-memory "network": every FakeTransport that has connect()-ed registers itself here so
// a peer connecting by id can find it. Test-only stand-in for PeerJS's signaling server.
const network = new Map<string, FakeTransport>();

/**
 * In-memory `Transport` double for tests — no real networking. Supports many simultaneous
 * peers (a Host side with several Guests), same as the real PeerJS-backed implementation.
 */
export class FakeTransport implements Transport {
  private id: string | undefined;
  private peers = new Map<string, FakeTransport>();
  private messageHandlers: MessageHandler[] = [];
  private connectionChangeHandlers: ConnectionChangeHandler[] = [];

  async connect(remoteId?: string, requestedId?: string): Promise<string> {
    const id = requestedId ?? `fake-peer-${nextId++}`;
    if (network.has(id)) {
      throw new RequestedIdTakenError(`FakeTransport: id "${id}" is already taken`);
    }
    this.id = id;
    network.set(this.id, this);

    if (remoteId) {
      const remote = network.get(remoteId);
      if (!remote) {
        throw new PeerUnavailableError(`FakeTransport: no peer registered for id "${remoteId}"`);
      }
      this.linkTo(remote);
      remote.linkTo(this);
      remote.notifyConnectionChange(this.id, true);
    }

    return this.id;
  }

  send(message: unknown, peerId?: string): void {
    if (peerId !== undefined) {
      this.peers.get(peerId)?.receive(message, this.id!);
      return;
    }
    for (const peer of this.peers.values()) {
      peer.receive(message, this.id!);
    }
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  onConnectionChange(handler: ConnectionChangeHandler): void {
    this.connectionChangeHandlers.push(handler);
  }

  private linkTo(peer: FakeTransport): void {
    this.peers.set(peer.id!, peer);
  }

  private receive(message: unknown, fromPeerId: string): void {
    for (const handler of this.messageHandlers) {
      handler(message, fromPeerId);
    }
  }

  private notifyConnectionChange(peerId: string, connected: boolean): void {
    for (const handler of this.connectionChangeHandlers) {
      handler(peerId, connected);
    }
  }
}
