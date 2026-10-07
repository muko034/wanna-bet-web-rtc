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
  /** Test-only: forgets every registered peer, so one test's peers never leak into the next. */
  static resetNetwork(): void {
    network.clear();
  }

  private id: string | undefined;
  private peers = new Map<string, FakeTransport>();
  private messageHandlers: MessageHandler[] = [];
  private connectionChangeHandlers: ConnectionChangeHandler[] = [];
  private blackHole = false;

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
    if (this.blackHole) {
      return;
    }
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

  /** Test-only simulation of a dropped connection: notifies every linked peer that this one went offline. */
  disconnect(): void {
    for (const peer of this.peers.values()) {
      peer.notifyConnectionChange(this.id!, false);
    }
  }

  /** Drops every connection for good: linked peers see this one go offline, and this side hears nothing further. */
  close(): void {
    const id = this.id!;
    const peers = [...this.peers.values()];
    this.peers.clear();
    this.messageHandlers = [];
    this.connectionChangeHandlers = [];
    network.delete(id);
    for (const peer of peers) {
      peer.peers.delete(id);
      peer.notifyConnectionChange(id, false);
    }
  }

  private linkTo(peer: FakeTransport): void {
    this.peers.set(peer.id!, peer);
  }

  /** Test-only simulation of a silently dead link (e.g. a suspended tab): while on, this peer sends and receives nothing and no `close` is ever reported. */
  setBlackHole(enabled: boolean): void {
    this.blackHole = enabled;
  }

  private receive(message: unknown, fromPeerId: string): void {
    if (this.blackHole) {
      return;
    }
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
