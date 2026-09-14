import type { Transport } from '../transport/transport';
import { MAX_ROOM_PLAYERS, type Player, type Room } from './room';

type JoinMessage = { type: 'join'; payload: { name: string } };
type RejoinMessage = { type: 'rejoin'; payload: { reconnectToken: string } };
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

function isRejoinMessage(message: unknown): message is RejoinMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'rejoin' &&
    typeof (message as RejoinMessage).payload?.reconnectToken === 'string'
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
 * replies) and `rejoin` (reconnect matching by `reconnectToken`) over `transport`, and
 * tracks each player's live connection status, notifying `onRoomChange` with the updated
 * Room after every change so the Host's Lobby view stays live.
 */
export class ConnectionManager {
  room: Room;
  private readonly transport: Transport;
  private readonly onRoomChange: (room: Room) => void;
  /** Live connection binding: which player a currently-connected peer id belongs to. */
  private readonly playerIdByPeerId = new Map<string, string>();
  /** Private reconnect registry: which player a `reconnectToken` belongs to, used only to match a `rejoin`. */
  private readonly playerIdByReconnectToken = new Map<string, string>();

  constructor(transport: Transport, initialRoom: Room, onRoomChange: (room: Room) => void) {
    this.transport = transport;
    this.onRoomChange = onRoomChange;
    this.room = initialRoom;
    this.transport.onMessage((message, peerId) => this.handleMessage(message, peerId));
    this.transport.onConnectionChange((peerId, connected) => this.handleConnectionChange(peerId, connected));
  }

  private handleMessage(message: unknown, peerId: string): void {
    if (isJoinMessage(message)) {
      this.handleJoin(message, peerId);
    } else if (isRejoinMessage(message)) {
      this.handleRejoin(message, peerId);
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
    const reconnectToken = randomId();
    this.playerIdByPeerId.set(peerId, player.playerId);
    this.playerIdByReconnectToken.set(reconnectToken, player.playerId);

    const welcome: WelcomeMessage = {
      type: 'welcome',
      payload: { playerId: player.playerId, reconnectToken },
    };
    this.transport.send(welcome, peerId);
    this.onRoomChange(this.room);
  }

  /**
   * Matches a rejoining Guest back to its existing player record by `reconnectToken` — not
   * by name or by the public `playerId`, which a rejoin message never carries. An
   * unrecognized token (e.g. a stale/foreign one) is rejected rather than silently
   * creating a new player.
   */
  private handleRejoin(message: RejoinMessage, peerId: string): void {
    const { reconnectToken } = message.payload;
    const playerId = this.playerIdByReconnectToken.get(reconnectToken);
    if (playerId === undefined) {
      const rejected: RejectedMessage = { type: 'rejected', payload: { reason: 'UNKNOWN_PLAYER', action: 'rejoin' } };
      this.transport.send(rejected, peerId);
      return;
    }

    this.playerIdByPeerId.set(peerId, playerId);
    this.room = {
      ...this.room,
      players: this.room.players.map((p) => (p.playerId === playerId ? { ...p, connected: true } : p)),
    };

    const welcome: WelcomeMessage = { type: 'welcome', payload: { playerId, reconnectToken } };
    this.transport.send(welcome, peerId);
    this.onRoomChange(this.room);
  }

  private handleConnectionChange(peerId: string, connected: boolean): void {
    const playerId = this.playerIdByPeerId.get(peerId);
    if (playerId === undefined) {
      return;
    }
    this.room = {
      ...this.room,
      players: this.room.players.map((p) => (p.playerId === playerId ? { ...p, connected } : p)),
    };
    this.onRoomChange(this.room);
  }
}
