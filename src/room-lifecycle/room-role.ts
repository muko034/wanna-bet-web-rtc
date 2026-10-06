import type { Room } from './room';

/** Whether this device is the Host of the Room at `code`: the one rule behind every Host-only control. */
export function isHostRoom(code: string | undefined, room: Room | null): boolean {
  return !!code && !!room && room.code === code;
}
