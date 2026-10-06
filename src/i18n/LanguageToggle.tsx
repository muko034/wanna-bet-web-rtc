import { useLanguage } from './LanguageContext';

/** Segmented `PL | EN` control; the active language is marked with `aria-pressed`. */
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return (
    <div class="vb-lang-toggle">
      <button type="button" aria-pressed={language === 'pl'} onClick={() => setLanguage('pl')}>
        PL
      </button>
      <button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>
        EN
      </button>
    </div>
  );
}
