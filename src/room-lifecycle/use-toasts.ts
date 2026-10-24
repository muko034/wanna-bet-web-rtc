import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { Message } from '../i18n/dictionaries';

/** How long each toast stays up. */
export const TOAST_DURATION_MS = 3_500;

/** A notice floating in front of the screen: its text and an optional smaller hint line. */
export type Toast = { id: number; message: Message; hint?: Message };

/**
 * The toasts on screen and a function to raise more. Each toast lives its own `TOAST_DURATION_MS`,
 * so a newer one never cuts an older one short; all pending timers are cleared on unmount.
 */
export function useToasts(): { toasts: Toast[]; showToasts: (raised: Omit<Toast, 'id'>[]) => void } {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const showToasts = useCallback((raised: Omit<Toast, 'id'>[]) => {
    for (const toast of raised) {
      const id = nextId.current++;
      setToasts((current) => [...current, { ...toast, id }]);
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        setToasts((current) => current.filter((shown) => shown.id !== id));
      }, TOAST_DURATION_MS);
      timers.current.add(timer);
    }
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return { toasts, showToasts };
}
