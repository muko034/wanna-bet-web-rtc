import type { DisplayLanguage } from '../room-lifecycle/challenge-card';

export const en = {
  'home.title': 'Ready to\nplay?',
  'home.subtitle': 'Create a room for your friends, or join one with a code.',
  'home.create': 'Create a game',
  'home.join': 'Join a game',
};

export type MessageKey = keyof typeof en;

/** Typed against `en`, so a missing or extra key fails the build. */
export const pl: Record<MessageKey, string> = {
  'home.title': 'Gotowy\nna grę?',
  'home.subtitle': 'Stwórz pokój dla znajomych albo dołącz do istniejącego za pomocą kodu.',
  'home.create': 'Stwórz grę',
  'home.join': 'Dołącz do gry',
};

export const dictionaries: Record<DisplayLanguage, Record<MessageKey, string>> = { pl, en };
