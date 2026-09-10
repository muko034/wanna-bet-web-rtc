import Peer, { PeerError, type DataConnection } from 'peerjs';
import { PeerUnavailableError, RequestedIdTakenError, type Transport } from './transport';

/**
 * Real, PeerJS-backed `Transport` implementation used by the app. Not covered by the
 * fake-transport unit suite — a distinct smoke-test suite against a live/local
 * `peerjs-server` is deferred for later.
 */
export class PeerJsTransport implements Transport {
  private connections = new Map<string, DataConnection>();
  private messageHandlers: Array<(message: unknown, peerId: string) => void> = [];
  private connectionChangeHandlers: Array<(peerId: string, connected: boolean) => void> = [];

  connect(remoteId?: string, requestedId?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const peer = requestedId ? new Peer(requestedId) : new Peer();

      peer.on('error', (error) => {
        if (error instanceof PeerError && error.type === 'unavailable-id') {
          reject(new RequestedIdTakenError(error.message));
        } else if (error instanceof PeerError && error.type === 'peer-unavailable') {
          reject(new PeerUnavailableError(error.message));
        } else {
          reject(error);
        }
      });

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

  send(message: unknown, peerId?: string): void {
    if (peerId !== undefined) {
      this.connections.get(peerId)?.send(message);
      return;
    }
    for (const connection of this.connections.values()) {
      connection.send(message);
    }
  }

  onMessage(handler: (message: unknown, peerId: string) => void): void {
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
        handler(data, connection.peer);
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
