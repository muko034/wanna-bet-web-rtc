import type { Transport } from '../transport/transport';
import type { RoomRegistry } from './room-registry';

export type Player = {
  playerId: string;
  name: string;
  connected: boolean;
};

export type Room = {
  code: string;
  players: Player[];
  /** Total players, Host included — checked against `MAX_ROOM_PLAYERS`. */
  playerCount: number;
  started: boolean;
};

/** Room capacity cap (Host counts as one) — sized for personal-use scale, not for horizontal growth. */
export const MAX_ROOM_PLAYERS = 20;

/**
 * Creates a new Room: the caller becomes its Host. The returned `code` is the shareable
 * Room Code Guests use to connect, registered against the Transport's own connection id
 * via `registry`. No Guests are connected yet, but the Host itself counts toward
 * `playerCount` from the start.
 */
export async function createRoom(transport: Transport, registry: RoomRegistry): Promise<Room> {
  const transportId = await transport.connect();
  const code = registry.register(transportId);
  return { code, players: [], playerCount: 1, started: false };
}

/** Starts `room`'s game. Requires at least one Guest to have joined. */
export function startGame(room: Room): Room {
  if (room.players.length === 0) {
    throw new Error('Cannot start a Room with no Guests');
  }
  return { ...room, started: true };
}
