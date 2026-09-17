import { challengeBank } from '../challenge-bank/challenge-bank';
import type { GameState } from '../protocol/messages';
import { HostProtocol } from '../protocol/host-protocol';
import { roundEngineReducer, type Prediction, type RoundEngineState } from '../round-engine/round-engine';
import type { Transport } from '../transport/transport';
import { applyRoundEngineState, buildInitialGameState, buildInitialRoundEngineState } from './game-state';
import { MAX_ROOM_PLAYERS, type Player, type Room } from './room';

function randomId(): string {
  return Math.random().toString(36).slice(2);
}

function randomPlayer(candidateIds: string[]): string {
  return candidateIds[Math.floor(Math.random() * candidateIds.length)];
}

/** Rotates `playerOrder` so `playerId` is at the front, preserving everyone else's relative order. */
function rotateToFront(playerOrder: string[], playerId: string): string[] {
  const index = playerOrder.indexOf(playerId);
  return [...playerOrder.slice(index), ...playerOrder.slice(0, index)];
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
 * replies) and `rejoin` (reconnect matching by `reconnectToken`) via `HostProtocol`, and
 * tracks each player's live connection status, notifying `onRoomChange` with the updated
 * Room after every change so the Host's Lobby view stays live.
 */
export class ConnectionManager {
  room: Room;
  gameState: GameState | null = null;
  private roundEngineState: RoundEngineState | null = null;
  private readonly protocol: HostProtocol;
  private readonly transport: Transport;
  private readonly onRoomChange: (room: Room) => void;
  private readonly pickChallenge: (candidateIds: string[]) => string;
  /** Picks the very first Active Player at random; every Round after that follows the fixed order it establishes. */
  private readonly pickActivePlayer: (candidateIds: string[]) => string;
  /** Live connection binding: which player a currently-connected peer id belongs to. */
  private readonly playerIdByPeerId = new Map<string, string>();
  /** Private reconnect registry: which player a `reconnectToken` belongs to, used only to match a `rejoin`. */
  private readonly playerIdByReconnectToken = new Map<string, string>();
  /** Active Player rotation order — starts as join order, then rotates so the drawn/next Active Player leads. */
  private playerOrder: string[] = [];
  private firstRoundStarted = false;

  constructor(
    transport: Transport,
    initialRoom: Room,
    onRoomChange: (room: Room) => void,
    pickChallenge: (candidateIds: string[]) => string = randomChallenge,
    pickActivePlayer: (candidateIds: string[]) => string = randomPlayer,
  ) {
    this.transport = transport;
    this.onRoomChange = onRoomChange;
    this.room = initialRoom;
    this.pickChallenge = pickChallenge;
    this.pickActivePlayer = pickActivePlayer;
    this.protocol = new HostProtocol(transport);
    this.protocol.on('join', (payload, peerId) => this.handleJoin(payload, peerId));
    this.protocol.on('placeBet', (payload, peerId) => this.handlePlaceBet(payload, peerId));
    this.protocol.on('rejoin', (payload, peerId) => this.handleRejoin(payload, peerId));
    this.transport.onConnectionChange((peerId, connected) => this.handleConnectionChange(peerId, connected));
  }

  /** Builds the initial GameState from the current Room — the Host included — and broadcasts it to every Guest. */
  startGame(): GameState {
    this.gameState = buildInitialGameState(this.room);
    this.roundEngineState = buildInitialRoundEngineState(this.room);
    this.playerOrder = this.roundEngineState.playerOrder;
    this.protocol.broadcastState(this.gameState);
    return this.gameState;
  }

  /**
   * Starts a Round for the next Active Player — picked at random the first time, then following the fixed
   * rotation order that first pick establishes (see `docs/game-rules.md`'s rotation rule).
   */
  startRound(): GameState {
    if (this.gameState === null || this.roundEngineState === null) {
      throw new Error('Cannot start a Round before the game has started');
    }

    const activePlayerId = this.firstRoundStarted
      ? this.playerOrder[0]
      : this.pickActivePlayer(this.playerOrder);

    if (!this.firstRoundStarted) {
      this.playerOrder = rotateToFront(this.playerOrder, activePlayerId);
      this.firstRoundStarted = true;
    }

    const { state: nextRoundEngineState } = roundEngineReducer(
      this.roundEngineState,
      {
        type: 'START_ROUND',
        activePlayerId,
        challengeBank,
        pickChallenge: this.pickChallenge,
      },
    );

    this.playerOrder = nextRoundEngineState.playerOrder;
    this.roundEngineState = nextRoundEngineState;
    this.gameState = applyRoundEngineState(this.gameState, nextRoundEngineState);
    this.protocol.broadcastState(this.gameState);
    return this.gameState;
  }

  placeBet(playerId: string, amount: number, prediction: Prediction): GameState {
    if (this.gameState === null || this.roundEngineState === null) {
      throw new Error('Cannot place a Bet before the game has started');
    }

    const { state: nextRoundEngineState } = roundEngineReducer(this.roundEngineState, {
      type: 'PLACE_BET',
      playerId,
      amount,
      prediction,
    });

    this.playerOrder = nextRoundEngineState.playerOrder;
    this.roundEngineState = nextRoundEngineState;
    this.gameState = applyRoundEngineState(this.gameState, nextRoundEngineState);
    this.protocol.broadcastState(this.gameState);
    return this.gameState;
  }

  private handleJoin(payload: { name: string }, peerId: string): void {
    if (this.room.playerCount >= MAX_ROOM_PLAYERS) {
      this.protocol.rejected(peerId, { reason: 'ROOM_FULL', action: 'join' });
      return;
    }

    const name = disambiguate(
      payload.name,
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

    this.protocol.welcome(peerId, { playerId: player.playerId, reconnectToken });
    this.onRoomChange(this.room);
  }

  /**
   * Matches a rejoining Guest back to its existing player record by `reconnectToken` — not
   * by name or by the public `playerId`, which a rejoin message never carries. An
   * unrecognized token (e.g. a stale/foreign one) is rejected rather than silently
   * creating a new player.
   */
  private handleRejoin(payload: { reconnectToken: string }, peerId: string): void {
    const { reconnectToken } = payload;
    const playerId = this.playerIdByReconnectToken.get(reconnectToken);
    if (playerId === undefined) {
      this.protocol.rejected(peerId, { reason: 'UNKNOWN_PLAYER', action: 'rejoin' });
      return;
    }

    this.playerIdByPeerId.set(peerId, playerId);
    this.room = {
      ...this.room,
      players: this.room.players.map((p) => (p.playerId === playerId ? { ...p, connected: true } : p)),
    };

    this.protocol.welcome(peerId, { playerId, reconnectToken });
    this.onRoomChange(this.room);
  }

  private handlePlaceBet(payload: { amount: number; prediction: Prediction }, peerId: string): void {
    const playerId = this.playerIdByPeerId.get(peerId);
    if (playerId === undefined) {
      return;
    }

    this.placeBet(playerId, payload.amount, payload.prediction);
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

function randomChallenge(candidateIds: string[]): string {
  return candidateIds[Math.floor(Math.random() * candidateIds.length)];
}
