import { describe, expect, it } from 'vitest';
import { REASSURANCE_DELAY_MS, resolveReconnectingMessage } from './reconnecting-message';

describe('resolveReconnectingMessage', () => {
  it('shows the plain "Reconnecting…" label right away', () => {
    expect(resolveReconnectingMessage(0)).toBe('Reconnecting…');
  });

  it('keeps the plain label until the reassurance delay has passed', () => {
    expect(resolveReconnectingMessage(REASSURANCE_DELAY_MS - 1)).toBe('Reconnecting…');
  });

  it('switches to a reassurance message once the reassurance delay has passed', () => {
    expect(resolveReconnectingMessage(REASSURANCE_DELAY_MS)).toBe('Still trying to reach the Host…');
  });

  it('keeps showing the reassurance message for the rest of the retry window', () => {
    expect(resolveReconnectingMessage(REASSURANCE_DELAY_MS + 60_000)).toBe('Still trying to reach the Host…');
  });
});
