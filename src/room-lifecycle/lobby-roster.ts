import type { Message } from '../i18n/dictionaries';
import type { Player } from '../protocol/messages';

export type LobbyRosterEntry = {
  playerId: string;
  /** Name, marked as "you" on the local player's own row. */
  nameLabel: Message;
};

/**
 * Resolves the Lobby roster's display shape — shared by the Host's own Lobby and a Guest's
 * waiting screen, both of which render the same `GameState.players` list from a Lobby
 * snapshot. No Points are shown here (unlike the in-game scoreboard) — the Lobby only ever
 * displays names.
 */
export function resolveLobbyRoster({
  players,
  localPlayerId,
}: {
  /** `null` before any Lobby snapshot has arrived. */
  players: Player[] | null;
  /** `null` until this device's own identity is known (e.g. a Guest mid-join). */
  localPlayerId: string | null;
}): LobbyRosterEntry[] {
  return (players ?? []).map((player) => ({
    playerId: player.playerId,
    nameLabel: { key: player.playerId === localPlayerId ? 'player.you' : 'player.named', params: { name: player.name } },
  }));
}
