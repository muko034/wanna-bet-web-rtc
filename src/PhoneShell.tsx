import type { ComponentChildren } from 'preact';
import { withBase } from './base-path';
import { handleHomeClick } from './home-click';
import { useT } from './i18n/LanguageContext';
import { LanguageToggle } from './i18n/LanguageToggle';

type Props = {
  /** One of the `vb-bg-*` gradient classes from `index.css`, giving each screen its own color block. */
  background: string;
  /** Room Code shown in the footer once a Room exists. */
  roomCode?: string;
  /** Hides the Exit button, on screens with nowhere to exit from (Home, Not Found). */
  hideExit?: boolean;
  /** Runs when the Exit button is tapped, for screens that must handle it themselves instead of navigating Home. */
  onHome?: () => void;
  /** Content for the top bar's right slot, such as the Leaderboard badge. */
  topRight?: ComponentChildren;
  /** Rendered above the whole screen, such as the Leaderboard sheet. */
  overlay?: ComponentChildren;
  children: ComponentChildren;
};

/**
 * Full-bleed, mobile-first phone frame shared by every screen — the "Big State" layout:
 * one giant color-block idea per screen instead of small cards.
 */
export function PhoneShell({ background, roomCode, hideExit, onHome, topRight, overlay, children }: Props) {
  const t = useT();
  return (
    <div class="vb">
      <div class={`vb-phone ${background}`}>
        <div class="vb-topbar">
          {hideExit ? (
            <span />
          ) : (
            <a
              class="vb-fab"
              href={withBase('/')}
              aria-label={t('exit.label')}
              onClick={onHome && ((event) => handleHomeClick(event, onHome))}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M5 3h8a2 2 0 0 1 2 2v3h-2V5H5v14h8v-3h2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm12.6 5.4L22 12l-4.4 3.6-1.3-1.5 1.7-1.6H9v-2h8l-1.7-1.6z" />
              </svg>
            </a>
          )}
          <div class="vb-topbar-right">
            {topRight}
            <LanguageToggle />
          </div>
        </div>
        <div class="vb-stage">{children}</div>
        {roomCode && <div class="vb-room-footer">{roomCode}</div>}
        {overlay}
      </div>
    </div>
  );
}
