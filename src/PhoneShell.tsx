import type { ComponentChildren } from 'preact';

type Props = {
  /** One of the `vb-bg-*` gradient classes from `index.css`, matching the prototype's per-screen color blocks. */
  background: string;
  /** Room Code shown in the top bar once a Room exists. */
  roomCode?: string;
  /** Optional control (e.g. a back button) in the top-left corner of the top bar. */
  topLeft?: ComponentChildren;
  children: ComponentChildren;
};

/**
 * Full-bleed, mobile-first phone frame shared by every screen — the "Big State" layout
 * from `docs/ui-design`: one giant color-block idea per screen instead of small cards.
 */
export function PhoneShell({ background, roomCode, topLeft, children }: Props) {
  return (
    <div class="vb">
      <div class={`vb-phone ${background}`}>
        <div class="vb-topbar">
          {topLeft ?? <span />}
          <span>{roomCode ? `Room ${roomCode}` : ''}</span>
          <span />
        </div>
        <div class="vb-stage">{children}</div>
      </div>
    </div>
  );
}
