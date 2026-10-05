import type { Room } from './room';

export type HomeDialogOption = {
  action: 'leave' | 'go-home' | 'cancel';
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
  const isHost = room !== null && room.code === code;
  return {
    options: [
      isHost
        ? { action: 'go-home', label: 'Go Home', style: 'primary' }
        : { action: 'leave', label: 'Leave', style: 'destructive' },
      CANCEL,
    ],
  };
}
