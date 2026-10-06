import type { Message } from '../i18n/dictionaries';

/** How long the "Reconnecting…" screen shows before switching to a reassurance message. */
export const REASSURANCE_DELAY_MS = 25_000;

/** Picks the `ReconnectingScreen` copy from how long the current attempt has been running. */
export function resolveReconnectingMessage(elapsedMs: number): Message {
  return { key: elapsedMs >= REASSURANCE_DELAY_MS ? 'reconnecting.stillTrying' : 'reconnecting.plain' };
}
