import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
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
