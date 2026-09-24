import type { HostSession } from './host-session-store';

export type ResumePrompt = { kind: 'hidden' } | { kind: 'prompt'; roomCode: string };

type Params = {
  /** The most recently saved Host session on this device, if any. */
  session: HostSession | null;
  /** The Room Code in the current URL (`/room/<code>…`), or `null` off any Room's page. */
  routeCode: string | null;
};

/**
 * Decides whether reopening the app should offer the Host to resume a saved session: only when
 * one exists and the URL isn't some other Room's link (where
 * this device is visiting as a Guest).
 */
export function resolveResumePrompt({ session, routeCode }: Params): ResumePrompt {
  if (!session || (routeCode !== null && routeCode !== session.room.code)) {
    return { kind: 'hidden' };
  }
  return { kind: 'prompt', roomCode: session.room.code };
}
