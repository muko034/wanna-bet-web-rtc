/** The largest Bet a player with `points` may place: half their Points rounded down, but never below 1. */
export function maxBetAmount(points: number): number {
  return Math.max(1, Math.floor(points / 2));
}
