/**
 * How long a Guest sits on the "Reconnecting…" screen before its copy switches to a
 * reassurance message. Long enough that a normal, brief drop never shows it, short enough
 * that a Guest waiting out the full multi-minute automatic retry window (see
 * `guest-reconnect.ts`) isn't staring at a static label the whole time.
 */
export const REASSURANCE_DELAY_MS = 25_000;

/**
 * Picks the `ReconnectingScreen`'s copy from how long the current reconnect attempt has been
 * running. Pure so the threshold stays covered by a fast unit test — `ReconnectingScreen`
 * itself just tracks elapsed time and renders whatever this returns.
 */
export function resolveReconnectingMessage(elapsedMs: number): string {
  return elapsedMs >= REASSURANCE_DELAY_MS ? 'Still trying to reach the Host…' : 'Reconnecting…';
}
