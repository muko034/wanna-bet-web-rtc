import type { GameState, PlaceBetPayload, Prediction } from '../protocol/messages';
import { roundKeyOf } from './bet-delivery';

type Params = {
  gameState: GameState | null;
  localPlayerId: string | null | undefined;
  prediction: Prediction | null;
  amount: number;
};

export type LockIn = { roundKey: string; playerId: string; bet: PlaceBetPayload };

/** The Bet to send for the open Round, or `null` while anything it needs is still absent. */
export function resolveLockIn({ gameState, localPlayerId, prediction, amount }: Params): LockIn | null {
  if (!gameState?.round || !localPlayerId || prediction === null) return null;
  const roundKey = roundKeyOf(gameState);
  if (!roundKey) return null;
  return { roundKey, playerId: localPlayerId, bet: { amount, prediction, challengeId: gameState.round.challengeId } };
}
