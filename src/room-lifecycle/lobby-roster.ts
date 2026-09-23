import type { Player } from '../protocol/messages';

export type LobbyRosterEntry = {
  playerId: string;
  /** Name, suffixed with "(you)" on the local player's own row. */
  nameLabel: string;
};

/**
 * Resolves the Lobby roster's display shape — shared by the Host's own Lobby and a Guest's
 * waiting screen, both of which render the same `GameState.players` list from a Lobby
 * snapshot (see `docs/spec/round-engine/21-lobby-roster-for-host-and-guests.md`). No Points
 * are shown here (unlike the in-game scoreboard) — the Lobby only ever displays names.
 */
export function resolveLobbyRoster({
  players,
  localPlayerId,
}: {
  players: Player[];
  /** `null` until this device's own identity is known (e.g. a Guest mid-join). */
  localPlayerId: string | null;
}): LobbyRosterEntry[] {
  return players.map((player) => ({
    playerId: player.playerId,
    nameLabel: player.playerId === localPlayerId ? `${player.name} (you)` : player.name,
  }));
}
