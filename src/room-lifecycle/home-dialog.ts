import type { MessageKey } from '../i18n/dictionaries';
import type { Room } from './room';
import { isHostRoom } from './room-role';

export type HomeDialogAction = 'leave' | 'sit-out' | 'go-home' | 'cancel';

export type HomeDialogOption = {
  action: HomeDialogAction;
  label: MessageKey;
  style: 'destructive' | 'primary' | 'link';
};

export type HomeDialog = { options: HomeDialogOption[] };

type Params = {
  /** The `:code` route param at `/room/<code>/play`. */
  code: string | undefined;
  /** This device's own Room, if it is the Host — `null` on a Guest's device. */
  room: Room | null;
};

const CANCEL: HomeDialogOption = { action: 'cancel', label: 'homeDialog.cancel', style: 'link' };

/** Options of the confirmation dialog the Home button opens during a Game, by role: a Guest may Leave or Sit out; the Host may Leave (ending the Room) or Go Home (the Room stays open). */
export function resolveHomeDialog({ code, room }: Params): HomeDialog {
  const isHost = isHostRoom(code, room);
  return {
    options: [
      { action: 'leave', label: 'homeDialog.leave', style: 'destructive' },
      isHost
        ? { action: 'go-home', label: 'homeDialog.goHome', style: 'primary' }
        : { action: 'sit-out', label: 'homeDialog.sitOut', style: 'primary' },
      CANCEL,
    ],
  };
}

export type HomeChoiceEffect = { kind: 'leave'; code: string } | { kind: 'host-leave' } | { kind: 'sit-out'; code: string } | { kind: 'go-home' } | { kind: 'none' };

/** What happens once a dialog option is chosen: Cancel changes nothing, a Guest's Leave needs the Room code, the Host's Leave ends the Room. */
export function resolveHomeChoice(action: HomeDialogAction, code: string | undefined, room: Room | null): HomeChoiceEffect {
  if (action === 'go-home') {
    return { kind: 'go-home' };
  }
  if (action === 'leave' && isHostRoom(code, room)) {
    return { kind: 'host-leave' };
  }
  if (action === 'leave' && code) {
    return { kind: 'leave', code };
  }
  if (action === 'sit-out' && code) {
    return { kind: 'sit-out', code };
  }
  return { kind: 'none' };
}
