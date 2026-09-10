import { RoomRegistry } from './room-registry';

/**
 * Shared `RoomRegistry` instance for this app. It holds no per-session state itself (Room
 * Code generation is random, and a code's Transport ID is a pure function of the code) —
 * this single instance just avoids constructing a fresh one at every call site.
 */
export const roomRegistry = new RoomRegistry();
