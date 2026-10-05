import { useEffect, useState } from 'preact/hooks';
import { copyText } from './copy-text';

const COPIED_FEEDBACK_MS = 2_000;

type Props = {
  /** The full invite URL to copy. */
  link: string;
};

/** Icon button that copies the invite link and shows a check mark for about 2 seconds afterwards. */
export function CopyInviteButton({ link }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button type="button" class="vb-copy-btn" aria-label="Copy invite link" onClick={() => copyText(link).then((ok) => ok && setCopied(true))}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        {copied ? (
          <polyline points="20 6 9 17 4 12" />
        ) : (
          <>
            <rect x="9" y="9" width="12" height="12" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </>
        )}
      </svg>
    </button>
  );
}
