import { act, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dictionaries, type MessageKey } from '../i18n/dictionaries';
import { translate, type MessageParams } from '../i18n/translate';
import { ChallengeCardTitle } from './ChallengeCardTitle';
import type { ChallengeCardView } from './challenge-card';

const t = (key: MessageKey, params?: MessageParams) => translate(dictionaries.pl, key, params);
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

const THIRTY: NonNullable<ChallengeCardView['timeLimit']> = { label: '30s', seconds: 30, color: 'red' };
const cardWith = (timeLimit: ChallengeCardView['timeLimit'], kind: 'visible' | 'hidden' = 'visible'): ChallengeCardView =>
  kind === 'visible'
    ? { challengeType: 'PHYSICAL', timeLimit, kind, text: 'Do it' }
    : { challengeType: 'PHYSICAL', timeLimit, kind, title: { key: 'challengeCard.hiddenTitle' }, detail: { key: 'challengeCard.hiddenDetail' } };

const startButton = () => screen.getByRole('button', { name: t('challengeCard.startTimer', { limit: '30s' }) });
const ringButton = () => screen.getByRole('button', { name: t('challengeCard.stopTimer') });
const doneButton = () => screen.getByRole('button', { name: t('challengeCard.timerDone') });

type FakeOscillator = { startAt: number; stopAt: number };
let oscillators: FakeOscillator[];
class FakeAudioContext {
  currentTime = 0;
  destination = {};
  state = 'running';
  createOscillator() {
    const oscillator = {
      frequency: { value: 0 },
      type: 'sine',
      startAt: -1,
      stopAt: -1,
      connect: () => undefined,
      start(at: number) { oscillator.startAt = at; },
      stop(at: number) { oscillator.stopAt = at; },
    };
    oscillators.push(oscillator);
    return oscillator;
  }
  createGain() {
    const param = { setValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined };
    return { gain: param, connect: () => undefined };
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  oscillators = [];
  vi.stubGlobal('AudioContext', FakeAudioContext);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Timer start and stop', () => {
  it('offers no Timer on a Challenge without a Time Limit', () => {
    render(<ChallengeCardTitle card={cardWith(null)} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each(['visible', 'hidden'] as const)('starts on the %s card with the remaining seconds, and counts down', (kind) => {
    render(<ChallengeCardTitle card={cardWith(THIRTY, kind)} />);

    fireEvent.click(startButton());
    expect(ringButton().textContent).toBe('30');
    expect(screen.queryByRole('button', { name: t('challengeCard.startTimer', { limit: '30s' }) })).toBeNull();

    advance(1_000);
    expect(ringButton().textContent).toBe('29');
    advance(9_000);
    expect(ringButton().textContent).toBe('20');
  });

  it('drains the ring as time passes', () => {
    const { container } = render(<ChallengeCardTitle card={cardWith(THIRTY)} />);
    const offset = () => Number(container.querySelector('.vb-ring-fill')?.getAttribute('stroke-dashoffset'));

    fireEvent.click(startButton());
    expect(offset()).toBeCloseTo(0, 1);
    advance(15_000);
    expect(offset()).toBeCloseTo(47.12, 1);
  });

  it('runs for the Time Limit of the Challenge', () => {
    render(<ChallengeCardTitle card={cardWith({ label: '15s', seconds: 15, color: 'yellow' })} />);

    fireEvent.click(screen.getByRole('button', { name: t('challengeCard.startTimer', { limit: '15s' }) }));

    expect(ringButton().textContent).toBe('15');
  });

  it('stops on a tap of the running ring and shows the icon again', () => {
    render(<ChallengeCardTitle card={cardWith(THIRTY)} />);
    fireEvent.click(startButton());
    advance(3_000);

    fireEvent.click(ringButton());

    expect(startButton()).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('challengeCard.stopTimer') })).toBeNull();
  });

  it('starts over from the full Time Limit after a stop', () => {
    render(<ChallengeCardTitle card={cardWith(THIRTY)} />);
    fireEvent.click(startButton());
    advance(3_000);
    fireEvent.click(ringButton());

    fireEvent.click(startButton());

    expect(ringButton().textContent).toBe('30');
  });

  it('stops counting when the card goes away', () => {
    const { unmount } = render(<ChallengeCardTitle card={cardWith(THIRTY)} />);
    fireEvent.click(startButton());

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Timer last seconds', () => {
  it('turns the ring urgent only for the last 5 seconds', () => {
    render(<ChallengeCardTitle card={cardWith(THIRTY)} />);
    fireEvent.click(startButton());

    advance(24_000);
    expect(ringButton().textContent).toBe('6');
    expect(ringButton().classList.contains('urgent')).toBe(false);

    advance(1_000);
    expect(ringButton().textContent).toBe('5');
    expect(ringButton().classList.contains('urgent')).toBe(true);
  });
});

describe('Timer end', () => {
  it('stays red at 0, flashes the card and waits for a tap to bring the icon back', () => {
    const { container } = render(<ChallengeCardTitle card={cardWith(THIRTY)} />);
    fireEvent.click(startButton());
    expect(container.querySelector('.vb-task-flash')).toBeNull();

    advance(30_000);

    expect(doneButton().textContent).toBe('0');
    expect(doneButton().classList.contains('done')).toBe(true);
    expect(container.querySelector('.vb-task-flash')).not.toBeNull();

    advance(10_000);
    expect(doneButton().textContent).toBe('0');

    fireEvent.click(doneButton());
    expect(startButton()).toBeTruthy();
    expect(container.querySelector('.vb-task-flash')).toBeNull();
  });

  it('plays three short beeps and then one long one, once', () => {
    render(<ChallengeCardTitle card={cardWith(THIRTY)} />);
    fireEvent.click(startButton());
    expect(oscillators).toHaveLength(0);

    advance(30_000);
    advance(5_000);

    const beeps = oscillators.map((oscillator) => ({ start: oscillator.startAt, length: oscillator.stopAt - oscillator.startAt }));
    expect(beeps).toHaveLength(4);
    expect(beeps.slice(0, 3).every((beep) => beep.length > 0 && beep.length < 0.3)).toBe(true);
    expect(beeps[3].length).toBeGreaterThan(0.5);
    expect(beeps.every((beep, index) => index === 0 || beep.start >= beeps[index - 1].start + beeps[index - 1].length)).toBe(true);
  });

  it('plays no sound when the player returns after the end, and shows 0', () => {
    render(<ChallengeCardTitle card={cardWith(THIRTY)} />);
    fireEvent.click(startButton());

    vi.setSystemTime(Date.now() + 90_000);
    advance(500);

    expect(doneButton().textContent).toBe('0');
    expect(oscillators).toHaveLength(0);
  });

  it('plays no sound when the Timer is stopped before the end', () => {
    render(<ChallengeCardTitle card={cardWith(THIRTY)} />);
    fireEvent.click(startButton());
    advance(10_000);
    fireEvent.click(ringButton());
    advance(60_000);

    expect(oscillators).toHaveLength(0);
  });

  it('still counts down on a browser without audio', () => {
    vi.stubGlobal('AudioContext', undefined);
    render(<ChallengeCardTitle card={cardWith(THIRTY)} />);
    fireEvent.click(startButton());

    advance(30_000);

    expect(doneButton().textContent).toBe('0');
  });
});

describe('Timer Wake Lock', () => {
  let held: number;
  let requests: number;
  const stubWakeLock = () => {
    held = 0;
    requests = 0;
    vi.stubGlobal('navigator', {
      wakeLock: {
        request: async () => {
          requests++;
          held++;
          return { release: async () => { held--; } };
        },
      },
    });
  };
  const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
  const setVisibility = async (state: 'hidden' | 'visible') => {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    Object.defineProperty(document, 'hidden', { value: state === 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
  };
  afterEach(() => {
    delete (document as { visibilityState?: unknown }).visibilityState;
    delete (document as { hidden?: unknown }).hidden;
  });

  it('keeps the screen awake while the Timer runs and releases it on a stop', async () => {
    stubWakeLock();
    render(<ChallengeCardTitle card={cardWith(THIRTY)} />);

    fireEvent.click(startButton());
    await flush();
    expect(held).toBe(1);

    fireEvent.click(ringButton());
    await flush();
    expect(held).toBe(0);
  });

  it('releases it at the end of the Timer', async () => {
    stubWakeLock();
    render(<ChallengeCardTitle card={cardWith(THIRTY)} />);
    fireEvent.click(startButton());
    await flush();

    advance(30_000);
    await flush();

    expect(held).toBe(0);
  });

  it('releases it on unmount', async () => {
    stubWakeLock();
    const { unmount } = render(<ChallengeCardTitle card={cardWith(THIRTY)} />);
    fireEvent.click(startButton());
    await flush();

    unmount();
    await flush();

    expect(held).toBe(0);
  });

  it('is released while the tab is hidden and taken again when it is visible', async () => {
    stubWakeLock();
    render(<ChallengeCardTitle card={cardWith(THIRTY)} />);
    fireEvent.click(startButton());
    await flush();

    await setVisibility('hidden');
    expect(held).toBe(0);

    await setVisibility('visible');
    expect(held).toBe(1);
    expect(requests).toBe(2);
  });

  it('runs the Timer without error on a browser without Wake Lock', () => {
    vi.stubGlobal('navigator', {});
    render(<ChallengeCardTitle card={cardWith(THIRTY)} />);

    fireEvent.click(startButton());

    expect(ringButton().textContent).toBe('30');
  });

  it('runs the Timer when the Wake Lock request is refused', async () => {
    vi.stubGlobal('navigator', { wakeLock: { request: async () => { throw new Error('denied'); } } });
    render(<ChallengeCardTitle card={cardWith(THIRTY)} />);

    fireEvent.click(startButton());
    await flush();

    expect(ringButton().textContent).toBe('30');
  });
});
