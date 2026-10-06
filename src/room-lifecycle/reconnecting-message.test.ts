import { describe, expect, it } from 'vitest';
import { REASSURANCE_DELAY_MS, resolveReconnectingMessage } from './reconnecting-message';

describe('resolveReconnectingMessage', () => {
  it('shows the plain label right away', () => {
    expect(resolveReconnectingMessage(0)).toEqual({ key: 'reconnecting.plain' });
  });

  it('keeps the plain label until the reassurance delay has passed', () => {
    expect(resolveReconnectingMessage(REASSURANCE_DELAY_MS - 1)).toEqual({ key: 'reconnecting.plain' });
  });

  it('switches to a reassurance message once the reassurance delay has passed', () => {
    expect(resolveReconnectingMessage(REASSURANCE_DELAY_MS)).toEqual({ key: 'reconnecting.stillTrying' });
  });

  it('keeps showing the reassurance message for the rest of the retry window', () => {
    expect(resolveReconnectingMessage(REASSURANCE_DELAY_MS + 60_000)).toEqual({ key: 'reconnecting.stillTrying' });
  });
});
