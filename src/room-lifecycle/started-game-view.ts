import type { Room } from './room';

export type StartedGameView =
  | { view: 'started'; roomCode: string }
  | { view: 'redirect-to-lobby' }
  | { view: 'not-found' };

type Params = {
  /** The `:code` route param at `/room/<code>/play`. */
  code: string | undefined;
  /** This device's own Room, if it is the Host — `null` on a Guest's device. */
  room: Room | null;
  /**
   * The Room Code for which this Guest has locally observed the Host's `state` broadcast
   * with `status: 'active'` (via `watchForGameStart`) — `null` if this device hasn't seen
   * one, including on the Host's own device (which uses `room.started` instead).
   */
  guestGameStartedCode: string | null;
};

/**
 * Decides what `/room/<code>/play` should show, for either role: the Host (whose own
 * `Room` object is authoritative) or a Guest (who has no local `Room`, only whatever it
 * has observed over the wire via `watchForGameStart`). Neither device holds both signals
 * at once, so this treats them as two independent ways to reach the same "started" view
 * rather than requiring a unified Room model between Host and Guest.
 */
export function resolveStartedGameView({ code, room, guestGameStartedCode }: Params): StartedGameView {
  if (code !== undefined && room !== null && room.code === code) {
    return room.started ? { view: 'started', roomCode: room.code } : { view: 'redirect-to-lobby' };
  }

  if (code !== undefined && guestGameStartedCode === code) {
    return { view: 'started', roomCode: code };
  }

  return { view: 'not-found' };
}
