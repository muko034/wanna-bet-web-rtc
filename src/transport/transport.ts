/**
 * Wraps the underlying peer-to-peer networking (PeerJS in production) so that no other
 * slice depends on it directly.
 */
export interface Transport {
  /**
   * Opens this transport for use.
   *
   * - No args: becomes a Host awaiting connections under a networking-assigned id.
   * - `requestedId` only: becomes a Host under that specific id — used so a Room Code can
   *   deterministically derive the id a Guest connects to, with no shared lookup needed.
   *   Rejects with `RequestedIdTakenError` if that id is already in use.
   * - `remoteId`: connects as a Guest to that Host. Rejects with `PeerUnavailableError` if
   *   no peer is reachable under that id.
   *
   * Resolves with this device's own id once open/connected.
   */
  connect(remoteId?: string, requestedId?: string): Promise<string>;

  /**
   * Sends a message. With no `peerId`, broadcasts to every connected peer (used for the
   * `state` snapshot). With a `peerId`, sends only to that one connection (used for
   * `welcome`/`rejected`, which must reach only the Guest they're addressed to).
   */
  send(message: unknown, peerId?: string): void;

  /** Registers a handler invoked for every message received, tagged with the sending peer's id. */
  onMessage(handler: (message: unknown, peerId: string) => void): void;

  /**
   * Registers a handler invoked whenever a peer's connection status changes —
   * `connected: true` when it opens, `false` when it drops.
   */
  onConnectionChange(handler: (peerId: string, connected: boolean) => void): void;
}

/** A Host `connect(undefined, requestedId)` call asked for an id already claimed by another peer. */
export class RequestedIdTakenError extends Error {}

/** A Guest `connect(remoteId)` call found no peer reachable under that id. */
export class PeerUnavailableError extends Error {}

