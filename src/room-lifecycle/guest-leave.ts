import { GuestProtocol } from '../protocol/guest-protocol';
import type { Transport } from '../transport/transport';
import { deleteIdentity } from './player-identity';

/**
 * A Guest's Leave: tells the Host, forgets this device's identity for `code`'s Room and closes
 * `transport`, so nothing — a later `state` broadcast or an automatic reconnect — can pull the
 * Guest back into the Room.
 */
export function leaveRoom(transport: Transport, storage: Storage, code: string): void {
  new GuestProtocol(transport).leave();
  deleteIdentity(storage, code);
  transport.close();
}
