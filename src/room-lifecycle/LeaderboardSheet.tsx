import type { Leaderboard } from './leaderboard';

type BadgeProps = {
  badge: NonNullable<Leaderboard['badge']>;
  onOpen: () => void;
};

export function LeaderboardBadge({ badge, onOpen }: BadgeProps) {
  return (
    <button class="vb-rank-badge" type="button" onClick={onOpen}>
      {badge.medal && <span class="vb-rank-medal">{badge.medal}</span>}
      {badge.text}
    </button>
  );
}

type SheetProps = {
  rows: Leaderboard['rows'];
  onClose: () => void;
};

export function LeaderboardSheet({ rows, onClose }: SheetProps) {
  return (
    <div class="vb-rank-sheet-backdrop" onClick={onClose}>
      <div class="vb-rank-sheet" role="dialog" aria-label="Leaderboard" onClick={(event) => event.stopPropagation()}>
        <div class="vb-rank-sheet-handle" />
        <div class="vb-rank-sheet-title">Leaderboard</div>
        {rows.map((row) => (
          <div class={`vb-rank-sheet-row${row.isLocal ? ' me' : ''}${row.paused ? ' paused' : ''}`} key={row.playerId}>
            <span class="vb-rank-sheet-place">
              {row.medal ?? ''}#{row.rank}
            </span>
            <span class="vb-rank-sheet-name">
              {row.nameLabel}
              {row.paused && <span class="vb-score-sub">paused</span>}
            </span>
            <span>{row.points} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}
