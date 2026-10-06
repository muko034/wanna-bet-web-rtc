import type { ChallengeBankEntry } from '../challenge-bank/challenge-bank.schema';
import type { Message } from '../i18n/dictionaries';
import type { GameState } from '../protocol/messages';

export type DisplayLanguage = 'pl' | 'en';

export type ChallengeTimeLimitView = {
  label: '15s' | '30s' | '60s';
  color: 'yellow' | 'red' | 'black';
};

type ChallengeCardHeader = {
  challengeType: ChallengeBankEntry['type'];
  timeLimit: ChallengeTimeLimitView | null;
};

const TIME_LIMIT_VIEWS: Record<ChallengeBankEntry['timeLimit'], ChallengeTimeLimitView | null> = {
  NONE: null,
  QUARTER_MINUTE: { label: '15s', color: 'yellow' },
  HALF_MINUTE: { label: '30s', color: 'red' },
  ONE_MINUTE: { label: '60s', color: 'black' },
};

export type ChallengeCardView = ChallengeCardHeader &
  (
  | {
      kind: 'hidden';
      title: Message;
      detail: Message;
    }
  | {
      kind: 'visible';
      text: string;
      illustration?: string;
    });

type Params = {
  gameState: GameState | null;
  localPlayerId: string;
  challengeBank: ChallengeBankEntry[];
  displayLanguage: DisplayLanguage;
};

export function resolveChallengeCard({
  gameState,
  localPlayerId,
  challengeBank,
  displayLanguage,
}: Params): ChallengeCardView | null {
  const round = gameState?.round;
  if (round === null || round === undefined) {
    return null;
  }

  const challenge = challengeBank.find((entry) => entry.id === round.challengeId);
  if (!challenge) {
    throw new Error(`Unknown Challenge id "${round.challengeId}"`);
  }
  const header: ChallengeCardHeader = {
    challengeType: challenge.type,
    timeLimit: TIME_LIMIT_VIEWS[challenge.timeLimit],
  };

  if (round.challengerId === localPlayerId) {
    return {
      ...header,
      kind: 'hidden',
      title: { key: 'challengeCard.hiddenTitle' },
      detail: { key: 'challengeCard.hiddenDetail' },
    };
  }

  return {
    ...header,
    kind: 'visible',
    text: challenge.content[displayLanguage],
    ...(challenge.illustration ? { illustration: challenge.illustration } : {}),
  };
}
