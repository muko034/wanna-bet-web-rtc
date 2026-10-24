import { useT } from '../i18n/LanguageContext';
import type { MessageKey } from '../i18n/dictionaries';
import type { ChallengeCardView, ChallengeTimeLimitView } from './challenge-card';

const TYPE_LABELS: Record<ChallengeCardView['challengeType'], MessageKey> = {
  PHYSICAL: 'challengeCard.typePhysical',
  MENTAL: 'challengeCard.typeMental',
};

/** Outline stopwatch with the time limit as a small index at its lower right. */
function TimeLimitIcon({ timeLimit }: { timeLimit: ChallengeTimeLimitView }) {
  const maskId = `vb-timer-mask-${timeLimit.label}`;
  return (
    <svg class={`vb-timer ${timeLimit.color}`} viewBox="0 0 52 32" role="img" aria-label={timeLimit.label}>
      <title>{timeLimit.label}</title>
      {/* The number's silhouette is cut out of the ring, so a gap separates the two. */}
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="52" height="32">
        <rect width="52" height="32" fill="#fff" />
        <text class="vb-timer-gap" x="51" y="31">{timeLimit.label}</text>
      </mask>
      <g class="vb-timer-ring" mask={`url(#${maskId})`}>
        <path d="M12 2.5h8M16 2.5v4.2M16 18.5V12M25 8.5l2.4-2.4" />
        <circle cx="16" cy="18.5" r="11.5" />
      </g>
      <text class="vb-timer-number" x="51" y="31">{timeLimit.label}</text>
    </svg>
  );
}

/** Title line of the Challenge card: the Challenge type plus a colored time-limit stopwatch. */
export function ChallengeCardTitle({ card }: { card: ChallengeCardView }) {
  const t = useT();
  const { timeLimit } = card;
  return (
    <div class="vb-task-title">
      <div class="vb-task-label">{t(TYPE_LABELS[card.challengeType])}</div>
      {timeLimit && <TimeLimitIcon timeLimit={timeLimit} />}
    </div>
  );
}
