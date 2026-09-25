import { loadHostSession, type HostSession } from './host-session-store';

export type AutoResume =
  | { kind: 'none' }
  /** `landingPath` is app-root-relative (for `withBase`): the Lobby, or the started game's view. */
  | { kind: 'resume'; session: HostSession; landingPath: string };

/**
 * Decides whether the app, opened on `pathname`, should pick a Room this device hosted back up:
 * only on that Room's own link (`/room/<code>` or `/room/<code>/play`) and only when `storage`
 * holds a session for `<code>` — any other Room's link is left to the Guest join flow.
 */
export function resolveAutoResume(storage: Storage, pathname: string): AutoResume {
  const code = pathname.match(/\/room\/([^/]+)/)?.[1];
  const session = code === undefined ? null : loadHostSession(storage, code);
  if (!session) {
    return { kind: 'none' };
  }
  const lobbyPath = `room/${session.room.code}`;
  return { kind: 'resume', session, landingPath: session.room.started ? `${lobbyPath}/play` : lobbyPath };
}
