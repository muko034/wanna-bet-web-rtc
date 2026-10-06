import type { GameState } from '../protocol/messages';

/**
 * The toasts to show when `next` replaces `previous`: one per other player who sat out or left
 * in between. Silent without a previous snapshot (a view just opened), outside a running game,
 * and for the local player's own action.
 */
export function resolveRosterNotices(previous: GameState | null, next: GameState, localPlayerId: string | null): string[] {
  if (previous === null || previous.status !== 'active' || next.status !== 'active') {
    return [];
  }

  const notices: string[] = [];
  for (const before of previous.players) {
    if (before.playerId === localPlayerId) continue;
    const after = next.players.find((player) => player.playerId === before.playerId);
    if (!after) {
      notices.push(`${before.name} left`);
    } else if (before.status !== 'paused' && after.status === 'paused' && after.pausedBy === 'self') {
      notices.push(`${before.name} sat out`);
    }
  }
  return notices;
}
