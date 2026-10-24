import { useEffect, useRef, useState } from 'preact/hooks';
import { useT } from '../i18n/LanguageContext';

type Props = {
  /** How many Join Requests wait for the Host. */
  count: number;
  /** Opens the Join Request dialog for the first request. */
  onOpen: () => void;
};

/** The Host's top bar control for waiting Join Requests: disabled when none wait, shakes when a new one arrives. */
export function JoinRequestsBell({ count, onOpen }: Props) {
  const t = useT();
  const previousCount = useRef(count);
  const [arrivals, setArrivals] = useState(0);

  useEffect(() => {
    if (count > previousCount.current) setArrivals((n) => n + 1);
    previousCount.current = count;
  }, [count]);

  return (
    <button class="vb-bell" type="button" disabled={count === 0} aria-label={t('joinRequest.bell', { count })} onClick={onOpen}>
      <span class={arrivals > 0 ? 'vb-bell-icon vb-shake' : 'vb-bell-icon'} key={arrivals}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
          <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm6-6V11a6 6 0 0 0-4.5-5.82V4.5a1.5 1.5 0 0 0-3 0v.68A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z" />
        </svg>
      </span>
      {count > 0 && <span class="vb-bell-count" aria-hidden="true">{count}</span>}
    </button>
  );
}
