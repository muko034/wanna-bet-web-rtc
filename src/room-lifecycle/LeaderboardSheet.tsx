import { useRef, useState } from 'preact/hooks';
import { useT } from '../i18n/LanguageContext';
import type { MessageKey } from '../i18n/dictionaries';
import type { HostAction, Leaderboard } from './leaderboard';
import { resolveMenuPlacement, type MenuPlacement } from './menu-placement';

/** Matches the menu items' minimum height in `index.css`. */
const MENU_ITEM_HEIGHT_PX = 44;
const MENU_PADDING_PX = 8;

const HOST_ACTION_LABELS: Record<HostAction, MessageKey> = {
  pause: 'hostMenu.pause',
  resume: 'hostMenu.resume',
};

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
  /** Host only: runs `action` on the Guest `playerId`. */
  onHostAction?: (action: HostAction, playerId: string) => void;
};

type OpenMenu = { playerId: string; placement: MenuPlacement };

export function LeaderboardSheet({ rows, onClose, onHostAction }: SheetProps) {
  const t = useT();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);

  const toggleMenu = (trigger: HTMLElement, playerId: string, actionCount: number) => {
    if (openMenu?.playerId === playerId) {
      setOpenMenu(null);
      return;
    }
    const triggerRect = trigger.getBoundingClientRect();
    const sheetRect = sheetRef.current!.getBoundingClientRect();
    const placement = resolveMenuPlacement({
      triggerTop: triggerRect.top,
      triggerBottom: triggerRect.bottom,
      menuHeight: actionCount * MENU_ITEM_HEIGHT_PX + MENU_PADDING_PX,
      containerTop: sheetRect.top,
      containerBottom: sheetRect.bottom,
    });
    setOpenMenu({ playerId, placement });
  };

  const runHostAction = (action: HostAction, playerId: string) => {
    setOpenMenu(null);
    onHostAction?.(action, playerId);
  };

  return (
    <div class="vb-rank-sheet-backdrop" onClick={onClose}>
      <div
        class="vb-rank-sheet"
        role="dialog"
        aria-label="Leaderboard"
        ref={sheetRef}
        onClick={(event) => {
          event.stopPropagation();
          setOpenMenu(null);
        }}
      >
        <div class="vb-rank-sheet-handle" />
        <div class="vb-rank-sheet-title">{t('leaderboard.title')}</div>
        {rows.map((row) => (
          <div class={`vb-rank-sheet-row${row.isLocal ? ' me' : ''}${row.paused ? ' paused' : ''}`} key={row.playerId}>
            <span class="vb-rank-sheet-place">
              {row.medal ?? ''}#{row.rank}
            </span>
            <span class="vb-rank-sheet-name">
              {t(row.nameLabel.key, row.nameLabel.params)}
              {row.statusLabel && <span class="vb-score-sub">{t(row.statusLabel)}</span>}
            </span>
            <span>{t('leaderboard.points', { points: row.points })}</span>
            {row.hostActions.length > 0 && (
              <div class="vb-row-menu-anchor">
                <button
                  class="vb-row-menu-trigger"
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={openMenu?.playerId === row.playerId}
                  aria-label={t('hostMenu.open', { name: row.name })}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleMenu(event.currentTarget, row.playerId, row.hostActions.length);
                  }}
                >
                  ⋯
                </button>
                {openMenu?.playerId === row.playerId && (
                  <div class={`vb-row-menu ${openMenu.placement}`} role="menu">
                    {row.hostActions.map((action) => (
                      <button
                        key={action}
                        class="vb-row-menu-item"
                        type="button"
                        role="menuitem"
                        onClick={(event) => {
                          event.stopPropagation();
                          runHostAction(action, row.playerId);
                        }}
                      >
                        {t(HOST_ACTION_LABELS[action])}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
