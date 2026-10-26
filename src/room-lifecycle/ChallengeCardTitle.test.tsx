import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
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
    ['15s', 15, 'yellow'],
    ['30s', 30, 'red'],
    ['60s', 60, 'black'],
  ] as const)('shows the %s stopwatch in %s with the time limit inside the icon', (label, seconds, color) => {
    const { container } = render(<ChallengeCardTitle card={card({ label, seconds, color })} />);

    const control = screen.getByRole('button', { name: translate(dictionaries.pl, 'challengeCard.startTimer', { limit: label }) });
    expect(control.querySelector('.vb-timer')?.classList.contains(color)).toBe(true);
    expect(container.querySelector('.vb-timer-number')?.textContent).toBe(label);
  });

  it('draws no stopwatch when the Challenge has no time limit', () => {
    const { container } = render(<ChallengeCardTitle card={card(null)} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('.vb-timer')).toBeNull();
  });
});

describe('ChallengeCardTitle Challenger line', () => {
  const visibleCard = (challengerName: string): ChallengeCardView => ({
    challengeType: 'PHYSICAL',
    timeLimit: null,
    kind: 'visible',
    text: 'Do it',
    challengerName,
  });

  it.each(['pl', 'en'] as const)('tells a Bettor whose turn it is in %s', (language) => {
    localStorage.setItem('wanna-bet:language', language);

    render(<LanguageProvider><ChallengeCardTitle card={visibleCard('Anna')} /></LanguageProvider>);

    expect(screen.getByText(translate(dictionaries[language], 'challengeCard.challengerTurn', { name: 'Anna' }))).toBeTruthy();
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
