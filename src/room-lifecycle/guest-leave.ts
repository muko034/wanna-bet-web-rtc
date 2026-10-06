import { GuestProtocol } from '../protocol/guest-protocol';
import type { Transport } from '../transport/transport';
import { deleteIdentity } from './player-identity';

const SIT_OUT_CLOSE_DELAY_MS = 200;

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
 * A Guest's Sit out: tells the Host and closes `transport` shortly after, so the message is not
 * lost to an immediate teardown. Keeps this device's identity so opening the Room's play URL
 * again rejoins the Guest.
 */
export function sitOutOfRoom(transport: Transport): void {
  new GuestProtocol(transport).sitOut();
  setTimeout(() => transport.close(), SIT_OUT_CLOSE_DELAY_MS);
}
