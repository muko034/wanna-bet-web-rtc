import { PhoneShell } from '../PhoneShell';
import { useT } from '../i18n/LanguageContext';
import { NotFound } from '../NotFound';
import { withBase } from '../base-path';
import { CopyInviteButton } from './CopyInviteButton';
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
  const t = useT();
  if (!room || room.code !== code) {
    return <NotFound />;
  }

  const link = `${window.location.origin}${withBase(`room/${room.code}`)}`;
  const hasGuests = room.players.length > 0;
  const roster = resolveLobbyRoster({ players: gameState?.players ?? null, localPlayerId: room.hostPlayerId });

  return (
    <PhoneShell background="vb-bg-lobby" roomCode={room.code}>
      <div class="vb-eyebrow2">{t('lobby.roomCode')}</div>
      <div class="vb-code-giant">
        <span>{room.code}</span>
        <CopyInviteButton link={link} />
      </div>
      <div class="vb-avatar-row">
        {roster.length === 0 ? (
          <div class="vb-avatar">{t('lobby.waitingForPlayers')}</div>
        ) : (
          roster.map((entry) => (
            <div class="vb-avatar" key={entry.playerId}>
              {t(entry.nameLabel.key, entry.nameLabel.params)}
            </div>
          ))
        )}
      </div>
      <div class="vb-status-pill">{t('lobby.notStarted')}</div>
      <button class="vb-cta" type="button" disabled={!hasGuests} onClick={onStart}>
        {t('lobby.start')}
      </button>
    </PhoneShell>
  );
}
