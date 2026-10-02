import type { Player } from '../protocol/messages';

const MEDALS = ['🥇', '🥈', '🥉'];

export type LeaderboardRow = {
  playerId: string;
  rank: number;
  /** Medal for ranks 1 to 3, otherwise `null`. */
  medal: string | null;
  /** Name, suffixed with "(you)" on the local player's own row. */
  nameLabel: string;
  points: number;
  paused: boolean;
};

export type LeaderboardBadge = {
  text: string;
  medal: string | null;
};

export type Leaderboard = {
  /** `null` when the local player is unknown or removed. */
  badge: LeaderboardBadge | null;
  rows: LeaderboardRow[];
};

function medalFor(rank: number): string | null {
  return MEDALS[rank - 1] ?? null;
}

/**
 * Resolves the Leaderboard's badge and sheet rows. Players with equal Points share the lowest
 * rank of their group; removed players are left out. Shows Points only, never Bets.
 */
export function resolveLeaderboard({
  players,
  localPlayerId,
}: {
  /** `null` before any `state` has arrived. */
  players: Player[] | null;
  /** `null` until this device's own identity is known. */
  localPlayerId: string | null;
}): Leaderboard {
  const ranked = (players ?? [])
    .filter((player) => player.status !== 'removed')
    .sort((a, b) => b.points - a.points);

  const rows = ranked.map((player): LeaderboardRow => {
    const rank = ranked.findIndex((other) => other.points === player.points) + 1;
    return {
      playerId: player.playerId,
      rank,
      medal: medalFor(rank),
      nameLabel: player.playerId === localPlayerId ? `${player.name} (you)` : player.name,
      points: player.points,
      paused: player.status === 'paused',
    };
  });

  const own = rows.find((row) => row.playerId === localPlayerId);
  return {
    badge: own ? { text: `#${own.rank} · ${own.points} pts`, medal: own.medal } : null,
    rows,
  };
}
