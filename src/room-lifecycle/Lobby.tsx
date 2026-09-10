import { PhoneShell } from '../PhoneShell';
import { NotFound } from '../NotFound';
import type { Room } from './room';

type Props = {
  path?: string;
  code?: string;
  room: Room | null;
  onStart: () => void;
};

/**
 * `/room/<CODE>`: the Lobby — shows the Room Code/link, connected players, and the
 * (initially disabled) "Start game" action.
 */
export function Lobby({ room, code, onStart }: Props) {
  if (!room || room.code !== code) {
    return <NotFound />;
  }

  const link = `${window.location.origin}/room/${room.code}`;
  const hasGuests = room.players.length > 0;

  return (
    <PhoneShell background="vb-bg-lobby" roomCode={room.code}>
      <div class="vb-eyebrow2">Room code</div>
      <div class="vb-code-giant">{room.code}</div>
      <div class="vb-share-link">
        <code>{link}</code>
        <button type="button" onClick={() => navigator.clipboard?.writeText(link)}>
          Copy
        </button>
      </div>
      <div class="vb-avatar-row">
        {room.players.length === 0 ? (
          <div class="vb-avatar">Waiting for players…</div>
        ) : (
          room.players.map((player) => (
            <div class="vb-avatar" key={player.playerId}>
              {player.name}
            </div>
          ))
        )}
      </div>
      <div class="vb-status-pill">The game has not started yet.</div>
      <button class="vb-cta" type="button" disabled={!hasGuests} onClick={onStart}>
        Start game
      </button>
    </PhoneShell>
  );
}
