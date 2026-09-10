import type { Transport } from '../transport/transport';
import { MAX_ROOM_PLAYERS, type Player, type Room } from './room';

type JoinMessage = { type: 'join'; payload: { name: string } };
type WelcomeMessage = { type: 'welcome'; payload: { playerId: string; reconnectToken: string } };
type RejectedMessage = { type: 'rejected'; payload: { reason: string; action: string } };

function isJoinMessage(message: unknown): message is JoinMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'join' &&
    typeof (message as JoinMessage).payload?.name === 'string'
  );
}

function randomId(): string {
  return Math.random().toString(36).slice(2);
}

/** Disambiguates `name` against `existingNames` by appending a "(n)" suffix on collision. */
function disambiguate(name: string, existingNames: string[]): string {
  if (!existingNames.includes(name)) {
    return name;
  }
  let n = 2;
  while (existingNames.includes(`${name} (${n})`)) {
    n++;
  }
  return `${name} (${n})`;
}

/**
 * Host-side Connection Manager: binds incoming Guest connections to the Room's player
 * list. Handles `join` (capacity enforcement, name disambiguation, `welcome`/`rejected`
 * replies) over `transport`, notifying `onRoomChange` with the updated Room after every
 * change so the Host's Lobby view stays live.
 */
export class ConnectionManager {
  room: Room;
  private readonly transport: Transport;
  private readonly onRoomChange: (room: Room) => void;

  constructor(transport: Transport, initialRoom: Room, onRoomChange: (room: Room) => void) {
    this.transport = transport;
    this.onRoomChange = onRoomChange;
    this.room = initialRoom;
    this.transport.onMessage((message, peerId) => this.handleMessage(message, peerId));
  }

  private handleMessage(message: unknown, peerId: string): void {
    if (isJoinMessage(message)) {
      this.handleJoin(message, peerId);
    }
  }

  private handleJoin(message: JoinMessage, peerId: string): void {
    if (this.room.playerCount >= MAX_ROOM_PLAYERS) {
      const rejected: RejectedMessage = { type: 'rejected', payload: { reason: 'ROOM_FULL', action: 'join' } };
      this.transport.send(rejected, peerId);
      return;
    }

    const name = disambiguate(
      message.payload.name,
      this.room.players.map((p) => p.name),
    );
    const player: Player = { playerId: randomId(), name, connected: true };
    this.room = {
      ...this.room,
      players: [...this.room.players, player],
      playerCount: this.room.playerCount + 1,
    };

    const welcome: WelcomeMessage = {
      type: 'welcome',
      payload: { playerId: player.playerId, reconnectToken: randomId() },
    };
    this.transport.send(welcome, peerId);
    this.onRoomChange(this.room);
  }
}
