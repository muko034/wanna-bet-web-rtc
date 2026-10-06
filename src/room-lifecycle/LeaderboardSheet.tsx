import { useT } from '../i18n/LanguageContext';
import type { Leaderboard } from './leaderboard';

type BadgeProps = {
  badge: NonNullable<Leaderboard['badge']>;
  onOpen: () => void;
};

export function LeaderboardBadge({ badge, onOpen }: BadgeProps) {
  const t = useT();
  return (
    <button class="vb-rank-badge" type="button" onClick={onOpen}>
      {badge.medal && <span class="vb-rank-medal">{badge.medal}</span>}
      {t(badge.message.key, badge.message.params)}
    </button>
  );
}

type SheetProps = {
  rows: Leaderboard['rows'];
  onClose: () => void;
};

export function LeaderboardSheet({ rows, onClose }: SheetProps) {
  const t = useT();
  return (
    <div class="vb-rank-sheet-backdrop" onClick={onClose}>
      <div class="vb-rank-sheet" role="dialog" aria-label="Leaderboard" onClick={(event) => event.stopPropagation()}>
        <div class="vb-rank-sheet-handle" />
        <div class="vb-rank-sheet-title">{t('leaderboard.title')}</div>
        {rows.map((row) => (
          <div class={`vb-rank-sheet-row${row.isLocal ? ' me' : ''}${row.paused ? ' paused' : ''}`} key={row.playerId}>
            <span class="vb-rank-sheet-place">
              {row.medal ?? ''}#{row.rank}
            </span>
            <span class="vb-rank-sheet-name">
              {t(row.nameLabel.key, row.nameLabel.params)}
              {row.paused && <span class="vb-score-sub">{t('leaderboard.paused')}</span>}
            </span>
            <span>{t('leaderboard.points', { points: row.points })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
