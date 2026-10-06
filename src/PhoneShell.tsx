import type { ComponentChildren } from 'preact';
import { withBase } from './base-path';
import { handleHomeClick } from './home-click';
import { LanguageToggle } from './i18n/LanguageToggle';

type Props = {
  /** One of the `vb-bg-*` gradient classes from `index.css`, giving each screen its own color block. */
  background: string;
  /** Room Code shown in the footer once a Room exists. */
  roomCode?: string;
  /** Runs when the Home button is tapped, for screens rendered outside the Router that must handle it themselves. */
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
export function PhoneShell({ background, roomCode, onHome, topRight, overlay, children }: Props) {
  return (
    <div class="vb">
      <div class={`vb-phone ${background}`}>
        <div class="vb-topbar">
          <a
            class="vb-home-fab"
            href={withBase('/')}
            aria-label="Home"
            onClick={onHome && ((event) => handleHomeClick(event, onHome))}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M12 3 2 12h3v8h5v-6h4v6h5v-8h3z" />
            </svg>
          </a>
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
