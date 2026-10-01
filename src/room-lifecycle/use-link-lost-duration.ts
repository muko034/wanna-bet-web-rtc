import { useEffect, useState } from 'preact/hooks';

const TICK_MS = 1_000;

/** How long `lost` has been continuously true, in ms (refreshed every second), or `null` while it is false. */
export function useLinkLostDuration(lost: boolean): number | null {
  const [lostForMs, setLostForMs] = useState<number | null>(null);

  useEffect(() => {
    if (!lost) {
      setLostForMs(null);
      return;
    }
    const since = Date.now();
    setLostForMs(0);
    const timer = setInterval(() => setLostForMs(Date.now() - since), TICK_MS);
    return () => clearInterval(timer);
  }, [lost]);

  return lost ? lostForMs : null;
}
