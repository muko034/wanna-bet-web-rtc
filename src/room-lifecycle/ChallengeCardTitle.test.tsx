import { render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { dictionaries } from '../i18n/dictionaries';
import { LanguageProvider } from '../i18n/LanguageContext';
import { translate } from '../i18n/translate';
import { ChallengeCardTitle } from './ChallengeCardTitle';
import type { ChallengeCardView } from './challenge-card';

const card = (timeLimit: ChallengeCardView['timeLimit']): ChallengeCardView => ({
  challengeType: 'PHYSICAL',
  timeLimit,
  kind: 'visible',
  text: 'Do it',
});

describe('ChallengeCardTitle time limit', () => {
  it.each([
    ['15s', 'yellow'],
    ['30s', 'red'],
    ['60s', 'black'],
  ] as const)('shows the %s stopwatch in %s with the time limit inside the icon', (label, color) => {
    const { container } = render(<ChallengeCardTitle card={card({ label, color })} />);

    const timer = screen.getByRole('img', { name: label });
    expect(timer.classList.contains(color)).toBe(true);
    expect(container.querySelector('.vb-timer-number')?.textContent).toBe(label);
  });

  it('draws no stopwatch when the Challenge has no time limit', () => {
    render(<ChallengeCardTitle card={card(null)} />);

    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('ChallengeCardTitle Challenger line', () => {
  afterEach(() => localStorage.clear());

  const visibleCard = (challengerName: string): ChallengeCardView => ({
    challengeType: 'PHYSICAL',
    timeLimit: null,
    kind: 'visible',
    text: 'Do it',
    challengerName,
  });

  it.each([
    ['pl', 'Kolej na: Anna'],
    ['en', "Anna's turn"],
  ] as const)('tells a Bettor whose turn it is in %s', (language, expected) => {
    localStorage.setItem('wanna-bet:language', language);

    render(<LanguageProvider><ChallengeCardTitle card={visibleCard('Anna')} /></LanguageProvider>);

    expect(screen.getByText(expected)).toBeTruthy();
  });

  it('keeps the typed case and the "(n)" suffix of the name', () => {
    render(<ChallengeCardTitle card={visibleCard('ola (2)')} />);

    expect(screen.getByText(translate(dictionaries.pl, 'challengeCard.challengerTurn', { name: 'ola (2)' }))).toBeTruthy();
  });

  it('shows no Challenger line on the Challenger\'s own hidden card', () => {
    const hidden: ChallengeCardView = {
      challengeType: 'PHYSICAL',
      timeLimit: null,
      kind: 'hidden',
      title: { key: 'challengeCard.hiddenTitle' },
      detail: { key: 'challengeCard.hiddenDetail' },
    };

    const { container } = render(<ChallengeCardTitle card={hidden} />);

    expect(container.textContent).toBe(translate(dictionaries.pl, 'challengeCard.typePhysical'));
  });
});
