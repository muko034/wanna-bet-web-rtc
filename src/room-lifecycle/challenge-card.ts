import type { ChallengeBankEntry } from '../challenge-bank/challenge-bank.schema';
import type { GameState } from '../protocol/messages';

export type DisplayLanguage = 'pl' | 'en';

export type ChallengeCardView =
  | {
      kind: 'hidden';
      title: string;
      detail: string;
    }
  | {
      kind: 'visible';
      text: string;
      illustration?: string;
    };

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

  if (round.activePlayerId === localPlayerId) {
    return {
      kind: 'hidden',
      title: '🙈 Hidden from you',
      detail: 'Get ready to attempt it.',
    };
  }

  const challenge = challengeBank.find((entry) => entry.id === round.challengeId);
  if (!challenge) {
    throw new Error(`Unknown Challenge id "${round.challengeId}"`);
  }

  return {
    kind: 'visible',
    text: challenge.content[displayLanguage],
    ...(challenge.illustration ? { illustration: challenge.illustration } : {}),
  };
}
