import { RoomRegistry } from './room-registry';

/**
 * Shared Room Registry for this device's session — a Host device only ever hosts one
 * Room per app instance, so a single module-level registry is sufficient.
 */
export const roomRegistry = new RoomRegistry();
