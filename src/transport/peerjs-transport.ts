import Peer, { type DataConnection } from 'peerjs';
import type { Transport } from './transport';

/**
 * Real, PeerJS-backed `Transport` implementation used by the app. Not covered by the
 * fake-transport unit suite (see docs/spec/room-lifecycle/SPEC.md's Testing Decisions) —
 * a distinct smoke-test suite against a live/local `peerjs-server` is deferred, noted
 * there for later.
 */
export class PeerJsTransport implements Transport {
  private connections = new Map<string, DataConnection>();
  private messageHandlers: Array<(message: unknown) => void> = [];
  private connectionChangeHandlers: Array<(peerId: string, connected: boolean) => void> = [];

  connect(remoteId?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const peer = new Peer();

      peer.on('error', reject);

      peer.on('open', (id) => {
        if (remoteId === undefined) {
          peer.on('connection', (connection) => this.bindConnection(connection));
          resolve(id);
          return;
        }

        const connection = peer.connect(remoteId);
        connection.on('open', () => {
          this.bindConnection(connection);
          resolve(id);
        });
      });
    });
  }

  send(message: unknown): void {
    for (const connection of this.connections.values()) {
      connection.send(message);
    }
  }

  onMessage(handler: (message: unknown) => void): void {
    this.messageHandlers.push(handler);
  }

  onConnectionChange(handler: (peerId: string, connected: boolean) => void): void {
    this.connectionChangeHandlers.push(handler);
  }

  private bindConnection(connection: DataConnection): void {
    this.connections.set(connection.peer, connection);
    this.notifyConnectionChange(connection.peer, true);

    connection.on('data', (data) => {
      for (const handler of this.messageHandlers) {
        handler(data);
      }
    });

    connection.on('close', () => {
      this.connections.delete(connection.peer);
      this.notifyConnectionChange(connection.peer, false);
    });
  }

  private notifyConnectionChange(peerId: string, connected: boolean): void {
    for (const handler of this.connectionChangeHandlers) {
      handler(peerId, connected);
    }
  }
}
