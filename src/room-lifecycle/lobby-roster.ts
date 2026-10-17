import type { Message } from '../i18n/dictionaries';
import type { Player } from '../protocol/messages';

export type LobbyRosterEntry = {
  playerId: string;
  name: string;
  /** Name, marked as "you" on the local player's own row. */
  nameLabel: Message;
  /** The Host may remove this player: a Guest's row on the Host's own roster. */
  removable: boolean;
};

/**
 * Resolves the Lobby roster's display shape — shared by the Host's own Lobby and a Guest's
 * waiting screen, both of which render the same `GameState.players` list from a Lobby
 * snapshot. No Points are shown here (unlike the in-game scoreboard) — the Lobby only ever
 * displays names. A `removed` player (the Host's last Lobby snapshot before dropping them) is
 * never listed.
 */
export function resolveLobbyRoster({
  players,
  localPlayerId,
  canRemoveGuests = false,
}: {
  /** `null` before any Lobby snapshot has arrived. */
  players: Player[] | null;
  /** `null` until this device's own identity is known (e.g. a Guest mid-join). */
  localPlayerId: string | null;
  /** Only the Host's roster can remove players. */
  canRemoveGuests?: boolean;
}): LobbyRosterEntry[] {
  return (players ?? [])
    .filter((player) => player.status !== 'removed')
    .map((player) => {
      const isLocal = player.playerId === localPlayerId;
      return {
        playerId: player.playerId,
        name: player.name,
        nameLabel: { key: isLocal ? 'player.you' : 'player.named', params: { name: player.name } },
        removable: canRemoveGuests && !isLocal,
      };
    });
}
