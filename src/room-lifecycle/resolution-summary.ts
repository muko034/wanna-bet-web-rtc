import type { GameState } from '../protocol/messages';

export type ResolutionSummary = {
  activePlayerName: string;
  outcome: 'YES' | 'NO';
  pointChanges: Array<{
    playerId: string;
    name: string;
    points: number;
    change: number;
  }>;
};

export function resolveResolutionSummary(gameState: GameState | null): ResolutionSummary | null {
  const resolution = gameState?.resolution;
  if (!gameState || !resolution) {
    return null;
  }

  const activePlayerName = gameState.players.find((player) => player.playerId === resolution.activePlayerId)?.name;
  if (!activePlayerName) {
    return null;
  }

  return {
    activePlayerName,
    outcome: resolution.outcome,
    pointChanges: gameState.players
      .map((player) => ({
        playerId: player.playerId,
        name: player.name,
        points: player.points,
        change: resolution.payouts.find((payout) => payout.playerId === player.playerId)?.amount ?? 0,
      })),
  };
}
