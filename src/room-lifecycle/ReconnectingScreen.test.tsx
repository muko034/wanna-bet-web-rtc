import { render, screen } from '@testing-library/preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dictionaries } from '../i18n/dictionaries';
import { translate } from '../i18n/translate';
import { ReconnectingScreen } from './ReconnectingScreen';
import { REASSURANCE_DELAY_MS } from './reconnecting-message';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const plain = translate(dictionaries.pl, 'reconnecting.plain');
const stillTrying = translate(dictionaries.pl, 'reconnecting.stillTrying');
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('ReconnectingScreen reassurance timer', () => {
  it('switches to the reassurance message after the delay', () => {
    render(<ReconnectingScreen />);

    advance(REASSURANCE_DELAY_MS - 1);
    expect(screen.getByText(plain)).toBeTruthy();

    advance(1);
    expect(screen.getByText(stillTrying)).toBeTruthy();
  });

  it('restarts the delay when the screen remounts for a new attempt', () => {
    const first = render(<ReconnectingScreen />);
    advance(REASSURANCE_DELAY_MS - 1);
    first.unmount();

    render(<ReconnectingScreen />);
    advance(REASSURANCE_DELAY_MS - 1);

    expect(screen.getByText(plain)).toBeTruthy();
  });

  it('clears the timer on unmount', () => {
    const { unmount } = render(<ReconnectingScreen />);
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
