import { RequestedIdTakenError, type Transport } from '../transport/transport';
import type { RoomRegistry } from './room-registry';

export type Player = {
  playerId: string;
  name: string;
  connected: boolean;
};

export type Room = {
  code: string;
  /** The Host's own display name and playerId — the Host is a Player too, but never appears in `players` (that list is Guests only, per the Lobby's display). */
  hostName: string;
  hostPlayerId: string;
  players: Player[];
  /** Total players, Host included — checked against `MAX_ROOM_PLAYERS`. */
  playerCount: number;
  started: boolean;
};

function randomId(): string {
  return Math.random().toString(36).slice(2);
}

/** Room capacity cap (Host counts as one) — sized for personal-use scale, not for horizontal growth. */
export const MAX_ROOM_PLAYERS = 20;

/**
 * Creates a new Room: the caller becomes its Host. The returned `code` is the shareable
 * Room Code Guests use to connect — its Transport ID is deterministically derived via
 * `registry`, not looked up, so any Guest device can resolve it from the code alone (there
 * is no backend to hold a shared lookup). Retries with a fresh code if that derived id is
 * already claimed by an unrelated peer. No Guests are connected yet, but the Host itself
 * counts toward `playerCount` from the start.
 */
export async function createRoom(transport: Transport, registry: RoomRegistry, hostName: string): Promise<Room> {
  for (;;) {
    const code = registry.generate();
    try {
      await transport.connect(undefined, registry.transportIdFor(code));
      return { code, hostName, hostPlayerId: randomId(), players: [], playerCount: 1, started: false };
    } catch (error) {
      if (!(error instanceof RequestedIdTakenError)) {
        throw error;
      }
    }
  }
}

const REOPEN_RETRY_DELAY_MS = 3_000;
/** Matches how long the signalling server takes to drop a vanished tab's Transport ID (its heartbeat timeout). */
const REOPEN_GIVE_UP_AFTER_MS = 60_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reclaims `room`'s original Transport ID when the Host resumes a saved session, so Guests
 * reconnect through the same Room Code/link. Right after a crash the networking layer may still
 * hold that id for the Host's previous tab, so a `RequestedIdTakenError` is retried every few
 * seconds until the id frees up — rethrown once about a minute has passed. Any other error is
 * rethrown straight away.
 */
export async function reopenRoom(
  transport: Transport,
  registry: RoomRegistry,
  room: Room,
  wait: (ms: number) => Promise<void> = delay,
): Promise<void> {
  for (let waited = 0; ; waited += REOPEN_RETRY_DELAY_MS) {
    try {
      await transport.connect(undefined, registry.transportIdFor(room.code));
      return;
    } catch (error) {
      if (!(error instanceof RequestedIdTakenError) || waited >= REOPEN_GIVE_UP_AFTER_MS) {
        throw error;
      }
    }
    await wait(REOPEN_RETRY_DELAY_MS);
  }
}

/** Starts `room`'s game. Requires at least one Guest to have joined. */
export function startGame(room: Room): Room {
  if (room.players.length === 0) {
    throw new Error('Cannot start a Room with no Guests');
  }
  return { ...room, started: true };
}
