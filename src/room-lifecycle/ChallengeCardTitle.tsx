import { useT } from '../i18n/LanguageContext';
import type { MessageKey } from '../i18n/dictionaries';
import type { ChallengeCardView } from './challenge-card';

const TYPE_LABELS: Record<ChallengeCardView['challengeType'], MessageKey> = {
  PHYSICAL: 'challengeCard.typePhysical',
  MENTAL: 'challengeCard.typeMental',
};

/** Title line of the Challenge card: the Challenge type plus a colored time-limit hourglass. */
export function ChallengeCardTitle({ card }: { card: ChallengeCardView }) {
  const t = useT();
  const { timeLimit } = card;
  return (
    <div class="vb-task-title">
      <div class="vb-task-label">{t(TYPE_LABELS[card.challengeType])}</div>
      {timeLimit && (
        <svg
          class={`vb-hourglass ${timeLimit.color}`}
          viewBox="0 0 24 24"
          role="img"
          aria-label={timeLimit.label}
        >
          <title>{timeLimit.label}</title>
          <path d="M6 2h12v2c0 3-2 5-4 8 2 3 4 5 4 8v2H6v-2c0-3 2-5 4-8-2-3-4-5-4-8z" />
        </svg>
      )}
    </div>
  );
}
