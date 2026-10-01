import Peer, { PeerError, type DataConnection, type PeerJSOption } from 'peerjs';
import { isDebugMode } from '../debug-mode';
import { PeerUnavailableError, RequestedIdTakenError, type RecoverableTransport } from './transport';

/** Overrides PeerJS's cloud-hosted signaling defaults — used to point at a local/self-hosted server. */
export type PeerJsServerOptions = Pick<PeerJSOption, 'host' | 'port' | 'path' | 'secure'>;

function logTraffic(direction: 'tx' | 'rx', peerId: string, message: unknown): void {
  if (import.meta.env.DEV || isDebugMode()) {
    console.debug(`[${direction}]`, peerId, message);
  }
}

/**
 * Real, PeerJS-backed `Transport` implementation used by the app. Not covered by the
 * fake-transport unit suite — a distinct smoke-test suite against a live/local `peerjs-server`
 * validates it instead.
 */
export class PeerJsTransport implements RecoverableTransport {
  private connections = new Map<string, DataConnection>();
  private messageHandlers: Array<(message: unknown, peerId: string) => void> = [];
  private connectionChangeHandlers: Array<(peerId: string, connected: boolean) => void> = [];
  private peer: Peer | undefined;
  private readonly serverOptions: PeerJsServerOptions | undefined;
  /** The Transport ID this Host opened under, reused by `recover()` to rebuild a destroyed `Peer`. `undefined` on a Guest. */
  private lastRequestedId: string | undefined;

  constructor(serverOptions?: PeerJsServerOptions) {
    this.serverOptions = serverOptions;
  }

  connect(remoteId?: string, requestedId?: string): Promise<string> {
    if (remoteId === undefined) {
      this.lastRequestedId = requestedId;
    }
    return new Promise((resolve, reject) => {
      const options = this.serverOptions;
      const peer = requestedId
        ? new Peer(requestedId, options)
        : options
          ? new Peer(options)
          : new Peer();
      this.peer = peer;

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
          peer.on('connection', (connection) => {
            connection.on('open', () => this.bindConnection(connection));
          });
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
    logTraffic('tx', peerId ?? 'all', message);
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

  /**
   * Tears down this device's PeerJS connection and releases its resources. Not part of the
   * shared `Transport` interface — only the concrete PeerJS-backed adapter needs deterministic
   * teardown (e.g. between smoke-test cases).
   */
  close(): void {
    this.peer?.destroy();
    this.connections.clear();
  }

  /** Exposes the underlying `Peer` to the smoke tests only, to simulate stale or destroyed connections. */
  peerForTesting(): Peer {
    if (!this.peer) {
      throw new Error('peerForTesting() called before connect()');
    }
    return this.peer;
  }

  /**
   * Restores this Host's stale signaling connection (e.g. after the tab was backgrounded).
   * `peer.reconnect()` keeps open Guest `DataConnection`s; a destroyed `Peer` is rebuilt under
   * `lastRequestedId`, which drops them. Resolves `false` if the connection could not be restored.
   */
  recover(): Promise<boolean> {
    const peer = this.peer;
    if (!peer || this.lastRequestedId === undefined) {
      return Promise.resolve(false);
    }
    if (peer.open && !peer.disconnected) {
      return Promise.resolve(true);
    }
    if (peer.destroyed) {
      return this.rebuildHostPeer();
    }

    return new Promise((resolve) => {
      const onOpen = () => {
        cleanup();
        resolve(true);
      };
      const onError = () => {
        cleanup();
        if (peer.destroyed) {
          this.rebuildHostPeer().then(resolve);
        } else {
          resolve(false);
        }
      };
      const cleanup = () => {
        peer.off('open', onOpen);
        peer.off('error', onError);
      };
      peer.on('open', onOpen);
      peer.on('error', onError);
      try {
        peer.reconnect();
      } catch {
        cleanup();
        this.rebuildHostPeer().then(resolve);
      }
    });
  }

  /** Opens a brand new `Peer` under `lastRequestedId`, replacing a destroyed one — see `recover()`. */
  private rebuildHostPeer(): Promise<boolean> {
    if (this.lastRequestedId === undefined) {
      return Promise.resolve(false);
    }
    return this.connect(undefined, this.lastRequestedId)
      .then(() => true)
      .catch(() => false);
  }

  private bindConnection(connection: DataConnection): void {
    this.connections.set(connection.peer, connection);
    this.notifyConnectionChange(connection.peer, true);

    connection.on('data', (data) => {
      logTraffic('rx', connection.peer, data);
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
