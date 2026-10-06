import type { DisplayLanguage } from '../room-lifecycle/challenge-card';

const LANGUAGE_KEY = 'wanna-bet:language';

function isDisplayLanguage(value: string | null): value is DisplayLanguage {
  return value === 'pl' || value === 'en';
}

/** `pl*` gives Polish, `en*` gives English, anything else Polish. */
export function detectLanguage(browserLanguage: string): DisplayLanguage {
  return browserLanguage.toLowerCase().startsWith('en') ? 'en' : 'pl';
}

/** A stored valid value wins; otherwise detects from the browser. Never writes. */
export function loadLanguage(storage: Storage, browserLanguage: string): DisplayLanguage {
  const stored = storage.getItem(LANGUAGE_KEY);
  return isDisplayLanguage(stored) ? stored : detectLanguage(browserLanguage);
}

/** Deferred so a toggle tap never waits on the storage write. */
export function saveLanguage(storage: Storage, language: DisplayLanguage): void {
  setTimeout(() => storage.setItem(LANGUAGE_KEY, language), 0);
}
