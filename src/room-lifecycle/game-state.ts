import type { GameState } from '../protocol/messages';
import type { Room } from './room';
import type { RoundEngineState } from '../round-engine/round-engine';

/** Every Player's Points at the start of a fresh game, per the game rules. */
export const STARTING_POINTS = 100;

/**
 * Builds the initial `GameState` for `room` at the moment its game starts: no Round yet,
 * and every Player — the Host included, first in rotation order, followed by each Guest in
 * join order — at the same starting Points. This is the Round Engine's player list, distinct
 * from `Room.players` (which the Lobby renders as Guests only).
 */
export function buildInitialGameState(room: Room): GameState {
  return {
    roomId: room.code,
    status: 'active',
    round: null,
    players: [
      { playerId: room.hostPlayerId, name: room.hostName, points: STARTING_POINTS, status: 'active', connected: true },
      ...room.players.map((player) => ({
        playerId: player.playerId,
        name: player.name,
        points: STARTING_POINTS,
        status: 'active' as const,
        connected: player.connected,
      })),
    ],
  };
}

export function buildInitialRoundEngineState(room: Room): RoundEngineState {
  return {
    playerOrder: [room.hostPlayerId, ...room.players.map((player) => player.playerId)],
    points: Object.fromEntries([
      [room.hostPlayerId, STARTING_POINTS],
      ...room.players.map((player) => [player.playerId, STARTING_POINTS]),
    ]),
    challengeHistory: [],
    round: null,
  };
}

export function applyRoundEngineState(gameState: GameState, roundEngineState: RoundEngineState): GameState {
  return {
    ...gameState,
    players: gameState.players.map((player) => ({
      ...player,
      points: roundEngineState.points[player.playerId] ?? player.points,
    })),
    // Broadcast only public bet-placement status. The Host keeps amount/prediction inside
    // its authoritative Round Engine state.
    round: roundEngineState.round
      ? {
        ...roundEngineState.round,
        bets: roundEngineState.round.bets.map((bet) => ({ playerId: bet.playerId })),
      }
      : null,
  };
}
