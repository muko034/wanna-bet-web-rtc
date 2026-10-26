import { useT } from '../i18n/LanguageContext';
import type { MessageKey } from '../i18n/dictionaries';
import type { TimerView } from './challenge-timer';
import { useChallengeTimer } from './use-challenge-timer';
import type { ChallengeCardView, ChallengeTimeLimitView } from './challenge-card';

const TYPE_LABELS: Record<ChallengeCardView['challengeType'], MessageKey> = {
  PHYSICAL: 'challengeCard.typePhysical',
  MENTAL: 'challengeCard.typeMental',
};

/** Outline stopwatch with the time limit as a small index at its lower right. */
function TimeLimitIcon({ timeLimit }: { timeLimit: ChallengeTimeLimitView }) {
  const maskId = `vb-timer-mask-${timeLimit.label}`;
  return (
    <svg class={`vb-timer ${timeLimit.color}`} viewBox="0 0 52 32" aria-hidden="true">
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

const RING_RADIUS = 15;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Ring showing the seconds left; its fill drains as the Timer runs down. */
function TimerRing({ seconds, fraction }: { seconds: number; fraction: number }) {
  return (
    <>
      <svg viewBox="0 0 36 36" width={32} height={32} aria-hidden="true">
        <circle class="vb-ring-track" cx="18" cy="18" r={RING_RADIUS} />
        <circle
          class="vb-ring-fill"
          cx="18"
          cy="18"
          r={RING_RADIUS}
          stroke-dasharray={RING_CIRCUMFERENCE}
          stroke-dashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
          transform="rotate(-90 18 18)"
        />
      </svg>
      <span class="vb-ring-seconds">{seconds}</span>
    </>
  );
}

type TimerControlProps = { timeLimit: ChallengeTimeLimitView; view: TimerView; onStart: () => void; onStop: () => void };

/** The stopwatch icon that starts a local Timer for the Time Limit; while it runs, a ring that stops it when tapped. */
function TimerControl({ timeLimit, view, onStart, onStop }: TimerControlProps) {
  const t = useT();

  if (view.status === 'idle') {
    return (
      <button class="vb-timer-button" type="button" aria-label={t('challengeCard.startTimer', { limit: timeLimit.label })} onClick={onStart}>
        <TimeLimitIcon timeLimit={timeLimit} />
      </button>
    );
  }
  const stateClass = view.status === 'done' ? 'done' : view.urgent ? 'urgent' : '';
  return (
    <button
      class={`vb-timer-ring-button ${stateClass}`}
      type="button"
      aria-label={t(view.status === 'done' ? 'challengeCard.timerDone' : 'challengeCard.stopTimer')}
      onClick={onStop}
    >
      <TimerRing seconds={view.seconds} fraction={view.fraction} />
    </button>
  );
}

/** Title of the Challenge card: the Challenge type with a Timer control for its time limit, and under it whose turn it is. */
export function ChallengeCardTitle({ card }: { card: ChallengeCardView }) {
  const t = useT();
  const { timeLimit } = card;
  const { view, start, stop } = useChallengeTimer((timeLimit?.seconds ?? 0) * 1_000);
  const challengerName = card.kind === 'visible' ? card.challengerName : undefined;
  return (
    <div class="vb-task-head">
      {view.status === 'done' && <div class="vb-task-flash" />}
      <div class="vb-task-title">
        <div class="vb-task-anchor">
          <div class="vb-task-label">{t(TYPE_LABELS[card.challengeType])}</div>
          {timeLimit && (
            <div class="vb-task-trailing">
              <TimerControl timeLimit={timeLimit} view={view} onStart={start} onStop={stop} />
            </div>
          )}
        </div>
      </div>
      {challengerName && <div class="vb-task-challenger">{t('challengeCard.challengerTurn', { name: challengerName })}</div>}
    </div>
  );
}
