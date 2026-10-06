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

/**
 * A Guest's Sit out: tells the Host and closes `transport`, keeping this device's identity so
 * opening the Room's play URL again rejoins the Guest.
 */
export function sitOutOfRoom(transport: Transport): void {
  new GuestProtocol(transport).sitOut();
  transport.close();
}
