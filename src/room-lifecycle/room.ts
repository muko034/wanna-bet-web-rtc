import { RequestedIdTakenError, type Transport } from '../transport/transport';
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
 * Room Code Guests use to connect — its Transport ID is deterministically derived via
 * `registry`, not looked up, so any Guest device can resolve it from the code alone (see
 * ADR 0001: there is no backend to hold a shared lookup). Retries with a fresh code if
 * that derived id is already claimed by an unrelated peer. No Guests are connected yet,
 * but the Host itself counts toward `playerCount` from the start.
 */
export async function createRoom(transport: Transport, registry: RoomRegistry): Promise<Room> {
  for (;;) {
    const code = registry.generate();
    try {
      await transport.connect(undefined, registry.transportIdFor(code));
      return { code, players: [], playerCount: 1, started: false };
    } catch (error) {
      if (!(error instanceof RequestedIdTakenError)) {
        throw error;
      }
    }
  }
}

/** Starts `room`'s game. Requires at least one Guest to have joined. */
export function startGame(room: Room): Room {
  if (room.players.length === 0) {
    throw new Error('Cannot start a Room with no Guests');
  }
  return { ...room, started: true };
}
