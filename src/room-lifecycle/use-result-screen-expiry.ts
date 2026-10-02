import { useEffect } from 'preact/hooks';
import { expireResult, RESULT_SCREEN_DURATION_MS, type ResultMemory } from './result-screen';

/** Dismisses the shown Result Screen once `RESULT_SCREEN_DURATION_MS` has passed since it was first shown. */
export function useResultScreenExpiry(
  memory: ResultMemory,
  setMemory: (memory: ResultMemory) => void,
  now: () => number = Date.now,
): void {
  const shownAt = memory.shown?.shownAt ?? null;

  useEffect(() => {
    if (shownAt === null) {
      return;
    }
    const timer = setTimeout(() => setMemory(expireResult(memory, now())), Math.max(0, shownAt + RESULT_SCREEN_DURATION_MS - now()));
    return () => clearTimeout(timer);
  }, [shownAt]);
}
