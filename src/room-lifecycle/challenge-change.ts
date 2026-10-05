import type { GameState } from '../protocol/messages';

/**
 * Whether `next` shows a Redraw of `previous`'s Challenge: the same Round (same Challenger, no new
 * Resolution in between) with a different Challenge id. A Redraw never repeats the current
 * Challenge, so a changed id is unambiguous and needs no extra `GameState` field.
 */
export function isChallengeRedrawn(previous: GameState | null, next: GameState | null): boolean {
  if (!previous?.round || !next?.round) return false;
  return (
    previous.round.challengerId === next.round.challengerId &&
    previous.round.challengeId !== next.round.challengeId &&
    JSON.stringify(previous.resolution) === JSON.stringify(next.resolution)
  );
}
