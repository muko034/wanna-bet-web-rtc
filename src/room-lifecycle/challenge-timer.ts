const URGENT_SECONDS = 5;

export type TimerView =
  | { status: 'idle' }
  | {
      status: 'running' | 'done';
      /** Whole seconds left, rounded up: 0 only once the Timer is done. */
      seconds: number;
      /** Share of the Time Limit still left, from 1 down to 0. */
      fraction: number;
      /** The last seconds of a running Timer. */
      urgent: boolean;
    };

/** What a Timer that ends at `endAt` (`null` while none runs) shows at `nowMs`. */
export function resolveTimerView(endAt: number | null, nowMs: number, durationMs: number): TimerView {
  if (endAt === null) {
    return { status: 'idle' };
  }
  const remainingMs = Math.min(Math.max(endAt - nowMs, 0), durationMs);
  const seconds = Math.ceil(remainingMs / 1_000);
  return {
    status: remainingMs === 0 ? 'done' : 'running',
    seconds,
    fraction: remainingMs / durationMs,
    urgent: remainingMs > 0 && seconds <= URGENT_SECONDS,
  };
}
