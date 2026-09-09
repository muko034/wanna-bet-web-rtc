/**
 * Wraps the underlying peer-to-peer networking (PeerJS in production) so that no other
 * slice depends on it directly. See docs/spec/room-lifecycle/SPEC.md.
 */
export interface Transport {
  /**
   * Opens this transport for use. Called with no `remoteId` to become a Host awaiting
   * connections (resolves with this device's own shareable id). Called with a `remoteId`
   * to connect as a Guest to that Host (resolves with this device's own id, once the
   * connection to `remoteId` is open).
   */
  connect(remoteId?: string): Promise<string>;

  /** Sends a message to the connected peer(s). */
  send(message: unknown): void;

  /** Registers a handler invoked for every message received from a connected peer. */
  onMessage(handler: (message: unknown) => void): void;

  /**
   * Registers a handler invoked whenever a peer's connection status changes —
   * `connected: true` when it opens, `false` when it drops.
   */
  onConnectionChange(handler: (peerId: string, connected: boolean) => void): void;
}
