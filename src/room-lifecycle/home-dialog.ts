import type { Room } from './room';
import { isHostRoom } from './room-role';

export type HomeDialogAction = 'leave' | 'go-home' | 'cancel';

export type HomeDialogOption = {
  action: HomeDialogAction;
  label: string;
  style: 'destructive' | 'primary' | 'link';
};

export type HomeDialog = { options: HomeDialogOption[] };

type Params = {
  /** The `:code` route param at `/room/<code>/play`. */
  code: string | undefined;
  /** This device's own Room, if it is the Host — `null` on a Guest's device. */
  room: Room | null;
};

const CANCEL: HomeDialogOption = { action: 'cancel', label: 'Cancel', style: 'link' };

/** Options of the confirmation dialog the Home button opens during a Game, by role: a Guest may Leave, the Host may Go Home (the Room stays open). */
export function resolveHomeDialog({ code, room }: Params): HomeDialog {
  const isHost = isHostRoom(code, room);
  return {
    options: [
      isHost
        ? { action: 'go-home', label: 'Go Home', style: 'primary' }
        : { action: 'leave', label: 'Leave', style: 'destructive' },
      CANCEL,
    ],
  };
}

export type HomeChoiceEffect = { kind: 'leave'; code: string } | { kind: 'go-home' } | { kind: 'none' };

/** What happens once a dialog option is chosen: Cancel changes nothing, Leave needs the Room code. */
export function resolveHomeChoice(action: HomeDialogAction, code: string | undefined): HomeChoiceEffect {
  if (action === 'go-home') {
    return { kind: 'go-home' };
  }
  if (action === 'leave' && code) {
    return { kind: 'leave', code };
  }
  return { kind: 'none' };
}
