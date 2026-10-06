import type { Message } from '../i18n/dictionaries';
import type { GameState } from '../protocol/messages';

/** How long a roster notice stays up; equals the banner's CSS animation length. */
export const ROSTER_NOTICE_DURATION_MS = 3_500;

/**
 * The toasts to show when `next` replaces `previous`: one per other player who sat out or left
 * in between. Silent without a previous snapshot (a view just opened), outside a running game,
 * and for the local player's own action.
 */
export function resolveRosterNotices(previous: GameState | null, next: GameState, localPlayerId: string | null): Message[] {
  if (previous === null || previous.status !== 'active' || next.status !== 'active') {
    return [];
  }

  const notices: Message[] = [];
  for (const before of previous.players) {
    if (before.playerId === localPlayerId) continue;
    const after = next.players.find((player) => player.playerId === before.playerId);
    if (!after) {
      notices.push({ key: 'notice.left', params: { name: before.name } });
    } else if (before.status !== 'paused' && after.status === 'paused' && after.pausedBy === 'self') {
      notices.push({ key: 'notice.satOut', params: { name: before.name } });
    }
  }
  return notices;
}
