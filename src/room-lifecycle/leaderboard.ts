import type { Message, MessageKey } from '../i18n/dictionaries';
import type { Player } from '../protocol/messages';

const MEDALS = ['🥇', '🥈', '🥉'];

export type HostAction = 'pause' | 'resume';

export type LeaderboardRow = {
  playerId: string;
  rank: number;
  /** Medal for ranks 1 to 3, otherwise `null`. */
  medal: string | null;
  name: string;
  /** The player's name, marked as the local player's own on their row. */
  nameLabel: Message;
  points: number;
  paused: boolean;
  /** Names why a paused player sits out: a Host Pause or stepping away. */
  statusLabel: MessageKey | null;
  /** What the Host may do to this player from the row's menu; empty for everyone else. */
  hostActions: HostAction[];
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

/** Pause for an active Guest, Resume only for a Host Pause: a Sit Out is not the Host's to end. */
function hostActionsFor(player: Player): HostAction[] {
  if (player.status === 'active') return ['pause'];
  return player.status === 'paused' && player.pausedBy === 'host' ? ['resume'] : [];
}

function statusLabelFor(player: Player): MessageKey | null {
  if (player.status !== 'paused') return null;
  return player.pausedBy === 'self' ? 'leaderboard.steppedAway' : 'leaderboard.paused';
}

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
  isHost = false,
}: {
  /** `null` before any `state` has arrived. */
  players: Player[] | null;
  /** `null` until this device's own identity is known. */
  localPlayerId: string | null;
  /** Only the Host gets row menus, and never on their own row. */
  isHost?: boolean;
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
      name: player.name,
      nameLabel: { key: isLocal ? 'player.you' : 'player.named', params: { name: player.name } },
      points: player.points,
      paused: player.status === 'paused',
      statusLabel: statusLabelFor(player),
      hostActions: isHost && !isLocal ? hostActionsFor(player) : [],
      isLocal,
    };
  });

  const own = rows.find((row) => row.isLocal);
  return {
    badge: own ? { message: { key: 'leaderboard.badge', params: { rank: own.rank, points: own.points } }, medal: own.medal } : null,
    rows,
  };
}
