import type { GameState } from '../protocol/messages';
import { resolveLeaderboard, type LeaderboardRow } from './leaderboard';

export type GameResultRow = LeaderboardRow & {
  /** On the top Points; every player tied on them is a Winner. */
  isWinner: boolean;
};

export type GameResult = {
  title: string;
  rows: GameResultRow[];
  background: 'vb-bg-success';
};

/** The Game Result Screen's content once the Game has ended, `null` while it has not. */
export function resolveGameResult({
  gameState,
  localPlayerId,
}: {
  gameState: GameState | null;
  localPlayerId: string | null;
}): GameResult | null {
  if (gameState?.status !== 'ended') {
    return null;
  }
  const { rows } = resolveLeaderboard({ players: gameState.players, localPlayerId });
  return {
    title: 'Game over',
    rows: rows.map((row) => ({ ...row, isWinner: row.rank === 1 })),
    background: 'vb-bg-success',
  };
}
