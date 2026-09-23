import { PhoneShell } from '../PhoneShell';
import { NotFound } from '../NotFound';
import { withBase } from '../base-path';
import { resolveLobbyRoster } from './lobby-roster';
import type { GameState } from '../protocol/messages';
import type { Room } from './room';

type Props = {
  path?: string;
  code?: string;
  room: Room | null;
  /** The Host's own live `GameState` — a Lobby snapshot pre-game — used only for the roster. */
  gameState: GameState | null;
  onStart: () => void;
};

/**
 * `/room/<CODE>`: the Lobby — shows the Room Code/link, the full roster (the Host included,
 * marked "(you)"), and the (initially disabled) "Start game" action.
 */
export function Lobby({ room, gameState, code, onStart }: Props) {
  if (!room || room.code !== code) {
    return <NotFound />;
  }

  const link = `${window.location.origin}${withBase(`room/${room.code}`)}`;
  const hasGuests = room.players.length > 0;
  const roster = resolveLobbyRoster({ players: gameState?.players ?? null, localPlayerId: room.hostPlayerId });

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
        {roster.length === 0 ? (
          <div class="vb-avatar">Waiting for players…</div>
        ) : (
          roster.map((entry) => (
            <div class="vb-avatar" key={entry.playerId}>
              {entry.nameLabel}
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
