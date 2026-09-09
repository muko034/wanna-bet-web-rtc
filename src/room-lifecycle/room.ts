import type { Transport } from '../transport/transport';

export type Player = {
  playerId: string;
  name: string;
  connected: boolean;
};

export type Room = {
  roomId: string;
  players: Player[];
  /** Total players, Host included — checked against `MAX_ROOM_PLAYERS`. */
  playerCount: number;
};

/** Room capacity cap (Host counts as one) — personal-use scale, see ADR 0001. */
export const MAX_ROOM_PLAYERS = 20;

/**
 * Creates a new Room: the caller becomes its Host. The returned `roomId` is the
 * shareable link/code Guests use to connect. No Guests are connected yet, but the
 * Host itself counts toward `playerCount` from the start.
 */
export async function createRoom(transport: Transport): Promise<Room> {
  const roomId = await transport.connect();
  return { roomId, players: [], playerCount: 1 };
}
