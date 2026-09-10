import type { Transport } from './transport';

type MessageHandler = (message: unknown) => void;
type ConnectionChangeHandler = (peerId: string, connected: boolean) => void;

let nextId = 1;

// In-memory "network": every FakeTransport that has connect()-ed registers itself here so
// a peer connecting by id can find it. Test-only stand-in for PeerJS's signaling server.
const network = new Map<string, FakeTransport>();

/**
 * In-memory `Transport` double for tests — no real networking.
 */
export class FakeTransport implements Transport {
  private id: string | undefined;
  private peer: FakeTransport | undefined;
  private messageHandlers: MessageHandler[] = [];
  private connectionChangeHandlers: ConnectionChangeHandler[] = [];

  async connect(remoteId?: string): Promise<string> {
    this.id = `fake-peer-${nextId++}`;
    network.set(this.id, this);

    if (remoteId) {
      const remote = network.get(remoteId);
      if (!remote) {
        throw new Error(`FakeTransport: no peer registered for id "${remoteId}"`);
      }
      this.linkTo(remote);
      remote.linkTo(this);
      remote.notifyConnectionChange(this.id, true);
    }

    return this.id;
  }

  send(message: unknown): void {
    this.peer?.receive(message);
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  onConnectionChange(handler: ConnectionChangeHandler): void {
    this.connectionChangeHandlers.push(handler);
  }

  private linkTo(peer: FakeTransport): void {
    this.peer = peer;
  }

  private receive(message: unknown): void {
    for (const handler of this.messageHandlers) {
      handler(message);
    }
  }

  private notifyConnectionChange(peerId: string, connected: boolean): void {
    for (const handler of this.connectionChangeHandlers) {
      handler(peerId, connected);
    }
  }
}
