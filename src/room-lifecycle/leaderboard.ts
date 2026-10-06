import type { Message } from '../i18n/dictionaries';
import type { Player } from '../protocol/messages';

const MEDALS = ['🥇', '🥈', '🥉'];

export type LeaderboardRow = {
  playerId: string;
  rank: number;
  /** Medal for ranks 1 to 3, otherwise `null`. */
  medal: string | null;
  /** The player's name, marked as the local player's own on their row. */
  nameLabel: Message;
  points: number;
  paused: boolean;
  isLocal: boolean;
};

export type LeaderboardBadge = {
  message: Message;
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
    const isLocal = player.playerId === localPlayerId;
    return {
      playerId: player.playerId,
      rank,
      medal: medalFor(rank),
      nameLabel: { key: isLocal ? 'player.you' : 'player.named', params: { name: player.name } },
      points: player.points,
      paused: player.status === 'paused',
      isLocal,
    };
  });

  const own = rows.find((row) => row.isLocal);
  return {
    badge: own ? { message: { key: 'leaderboard.badge', params: { rank: own.rank, points: own.points } }, medal: own.medal } : null,
    rows,
  };
}
