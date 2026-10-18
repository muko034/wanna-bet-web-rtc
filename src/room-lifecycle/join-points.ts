import type { Player } from '../protocol/messages';
import { STARTING_POINTS } from './game-state';

/** The Points a Late Joiner starts with unless the Host sets others: the lowest among active players, the Host included. */
export function defaultJoinPoints(players: readonly Player[]): number {
  const activePoints = players.filter((player) => player.status === 'active').map((player) => player.points);
  return activePoints.length > 0 ? Math.min(...activePoints) : STARTING_POINTS;
}

/** Reads the Host's typed starting Points: a whole number of at least 1, no upper cap; anything else is `null`. */
export function parseJoinPoints(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const points = Number(trimmed);
  return Number.isSafeInteger(points) && points >= 1 ? points : null;
}
