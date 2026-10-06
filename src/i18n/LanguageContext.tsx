import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useState } from 'preact/hooks';
import type { DisplayLanguage } from '../room-lifecycle/challenge-card';
import { dictionaries, type MessageKey } from './dictionaries';
import { loadLanguage, saveLanguage } from './language-store';
import { translate, type MessageParams } from './translate';

type LanguageContextValue = {
  language: DisplayLanguage;
  setLanguage: (language: DisplayLanguage) => void;
};

const LanguageContext = createContext<LanguageContextValue>({ language: 'pl', setLanguage: () => {} });

export function LanguageProvider({ children }: { children: ComponentChildren }) {
  const [language, setLanguageState] = useState<DisplayLanguage>(() =>
    loadLanguage(localStorage, navigator.language),
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: DisplayLanguage) => {
    setLanguageState(next);
    saveLanguage(localStorage, next);
  }, []);

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}

/** Returns `t(key, params)` bound to the active language. */
export function useT(): (key: MessageKey, params?: MessageParams) => string {
  const { language } = useLanguage();
  return (key, params) => translate(dictionaries[language], key, params);
}
