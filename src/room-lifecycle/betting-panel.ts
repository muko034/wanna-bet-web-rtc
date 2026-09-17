import type { GameState, Prediction } from '../protocol/messages';

export type BettorStatus = {
  playerId: string;
  name: string;
  hasBet: boolean;
  isLocalPlayer: boolean;
};

export type BettingPanel =
  | { kind: 'hidden'; bettors: BettorStatus[] }
  | { kind: 'status'; bettors: BettorStatus[] }
  | { kind: 'submitted'; bettors: BettorStatus[] }
  | { kind: 'form'; bettors: BettorStatus[]; initialAmount: number; initialPrediction: Prediction };

type Params = {
  gameState: GameState | null;
  localPlayerId: string;
  locallySubmittedBet?: boolean;
};

export function resolveBettingPanel({
  gameState,
  localPlayerId,
  locallySubmittedBet = false,
}: Params): BettingPanel {
  const round = gameState?.round;
  if (!round) {
    return { kind: 'hidden', bettors: [] };
  }

  const playersById = new Map(gameState.players.map((player) => [player.playerId, player]));
  const bettors = gameState.players
    .filter((player) => player.playerId !== round.activePlayerId)
    .map((player) => ({
      playerId: player.playerId,
      name: playersById.get(player.playerId)?.name ?? player.playerId,
      hasBet: round.bets.some((bet) => bet.playerId === player.playerId),
      isLocalPlayer: player.playerId === localPlayerId,
    }));

  const localPlayer = playersById.get(localPlayerId);
  if (!localPlayer || localPlayerId === round.activePlayerId) {
    return { kind: 'status', bettors };
  }

  const localHasBet = bettors.some((bettor) => bettor.playerId === localPlayerId && bettor.hasBet);
  if (localHasBet) {
    return { kind: 'status', bettors };
  }

  if (locallySubmittedBet) {
    return { kind: 'submitted', bettors };
  }

  return {
    kind: 'form',
    bettors,
    initialAmount: 1,
    initialPrediction: 'YES',
  };
}
