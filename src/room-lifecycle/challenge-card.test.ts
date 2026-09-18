import { describe, expect, it } from 'vitest';
import type { GameState } from '../protocol/messages';
import type { ChallengeBankEntry } from '../challenge-bank/challenge-bank.schema';
import { resolveChallengeCard } from './challenge-card';

const illustratedChallenge: ChallengeBankEntry = {
  id: 'challenge-1',
  type: 'PHYSICAL',
  content: {
    pl: 'Polska treść wyzwania',
    en: 'English challenge text',
  },
  timeLimit: 'NONE',
  illustration: '/images/challenge-1.png',
};

function stateWith(overrides: Partial<GameState> = {}): GameState {
  return {
    roomId: 'ABCDEF',
    status: 'active',
    activePlayerId: 'guest-1',
    resolution: null,
    players: [
      { playerId: 'host-1', name: 'Host', points: 100, status: 'active', connected: true },
      { playerId: 'guest-1', name: 'Alex', points: 100, status: 'active', connected: true },
      { playerId: 'guest-2', name: 'Sam', points: 100, status: 'active', connected: true },
    ],
    round: {
      activePlayerId: 'guest-1',
      challengeId: illustratedChallenge.id,
      bets: [],
      outcome: null,
    },
    ...overrides,
  };
}

describe('resolveChallengeCard', () => {
  it('hides the Challenge text and Illustration on the Active Player device while the round is awaiting bets', () => {
    const view = resolveChallengeCard({
      gameState: stateWith(),
      localPlayerId: 'guest-1',
      challengeBank: [illustratedChallenge],
      displayLanguage: 'en',
    });

    expect(view).toEqual({
      kind: 'hidden',
      title: '🙈 Hidden from you',
      detail: 'Get ready to attempt it.',
    });
  });

  it.each([
    ['the Host when the Host is not the Active Player', 'host-1'],
    ['another Guest who is betting this round', 'guest-2'],
  ])('shows the real Challenge text and Illustration for %s', (_label, localPlayerId) => {
    const view = resolveChallengeCard({
      gameState: stateWith(),
      localPlayerId,
      challengeBank: [illustratedChallenge],
      displayLanguage: 'en',
    });

    expect(view).toEqual({
      kind: 'visible',
      text: 'English challenge text',
      illustration: '/images/challenge-1.png',
    });
  });

  it('returns no Challenge card before any round has started', () => {
    const view = resolveChallengeCard({
      gameState: stateWith({ round: null }),
      localPlayerId: 'host-1',
      challengeBank: [illustratedChallenge],
      displayLanguage: 'pl',
    });

    expect(view).toBeNull();
  });
});
