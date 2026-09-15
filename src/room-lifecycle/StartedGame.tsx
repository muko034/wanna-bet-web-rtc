import { route } from 'preact-router';
import { useEffect } from 'preact/hooks';
import { PhoneShell } from '../PhoneShell';
import { NotFound } from '../NotFound';
import { withBase } from '../base-path';
import { resolveStartedGameView } from './started-game-view';
import type { Room } from './room';

type Props = {
  path?: string;
  code?: string;
  room: Room | null;
  /** The Room Code for which this Guest has locally observed the Host's game-started broadcast — see `resolveStartedGameView`. */
  guestGameStartedCode: string | null;
};

/**
 * `/room/<CODE>/play`: neutral placeholder for the started game, with no gameplay logic
 * yet. Redirects the Host back to the Lobby if the Host's own Room hasn't started; a Guest
 * reaches this view via its own `guestGameStartedCode` signal instead, since a Guest never
 * holds a local `Room` object (see `resolveStartedGameView`).
 */
export function StartedGame({ code, room, guestGameStartedCode }: Props) {
  const view = resolveStartedGameView({ code, room, guestGameStartedCode });

  useEffect(() => {
    if (view.view === 'redirect-to-lobby') {
      route(withBase(`room/${code}`), true);
    }
  }, [view.view, code]);

  if (view.view === 'not-found') {
    return <NotFound />;
  }

  if (view.view === 'redirect-to-lobby') {
    return null;
  }

  return (
    <PhoneShell background="vb-bg-wait" roomCode={view.roomCode}>
      <div class="vb-giant-title" style="font-size:24px">
        Game started
      </div>
      <div class="vb-giant-sub">The game is underway. (Gameplay isn't implemented yet.)</div>
    </PhoneShell>
  );
}
