import { route } from 'preact-router';
import { useEffect } from 'preact/hooks';
import { PhoneShell } from '../PhoneShell';
import { NotFound } from '../NotFound';
import type { Room } from './room';

type Props = {
  path?: string;
  code?: string;
  room: Room | null;
};

/**
 * `/room/<CODE>/play`: neutral placeholder for the started game, with no gameplay logic
 * yet. Redirects back to the Lobby if the Room hasn't started.
 */
export function StartedGame({ code, room }: Props) {
  const roomMatches = room !== null && room.code === code;
  const hasStarted = roomMatches && room.started;

  useEffect(() => {
    if (roomMatches && !hasStarted) {
      route(`/room/${code}`, true);
    }
  }, [roomMatches, hasStarted, code]);

  if (!roomMatches) {
    return <NotFound />;
  }

  if (!hasStarted) {
    return null;
  }

  return (
    <PhoneShell background="vb-bg-wait" roomCode={room.code}>
      <div class="vb-giant-title" style="font-size:24px">
        Game started
      </div>
      <div class="vb-giant-sub">The game is underway. (Gameplay isn't implemented yet.)</div>
    </PhoneShell>
  );
}
