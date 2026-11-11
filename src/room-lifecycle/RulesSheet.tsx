import { useT } from '../i18n/LanguageContext';
import type { MessageKey } from '../i18n/dictionaries';

const FLOW_STEPS: MessageKey[] = ['rules.flow.challenger', 'rules.flow.bets', 'rules.flow.judge', 'rules.flow.points'];
const POINTS_RULES: MessageKey[] = ['rules.points.bettors', 'rules.points.yes', 'rules.points.no', 'rules.points.floor'];
const EXAMPLE_OUTCOMES: MessageKey[] = ['rules.example.yes', 'rules.example.no'];

type ButtonProps = {
  onOpen: () => void;
};

/** The `i` button in the top bar, next to the language toggle. */
export function RulesButton({ onOpen }: ButtonProps) {
  const t = useT();
  return (
    <button class="vb-rules-open" type="button" aria-label={t('rules.open')} onClick={onOpen}>
      i
    </button>
  );
}

type SheetProps = {
  onClose: () => void;
};

/** The Rules Sheet: a bottom sheet of static copy, closed by tapping outside it. It never shows live Bets. */
export function RulesSheet({ onClose }: SheetProps) {
  const t = useT();
  return (
    <div class="vb-rank-sheet-backdrop" onClick={onClose}>
      <div class="vb-rank-sheet" role="dialog" aria-label={t('rules.title')} onClick={(event) => event.stopPropagation()}>
        <div class="vb-rank-sheet-handle" />
        <div class="vb-rank-sheet-title">{t('rules.title')}</div>
        <section class="vb-rules-section">
          <h3 class="vb-rules-heading">{t('rules.flow.title')}</h3>
          <ol class="vb-rules-list">
            {FLOW_STEPS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ol>
        </section>
        <section class="vb-rules-section">
          <h3 class="vb-rules-heading">{t('rules.points.title')}</h3>
          <ul class="vb-rules-list">
            {POINTS_RULES.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </section>
        <section class="vb-rules-section">
          <h3 class="vb-rules-heading">{t('rules.example.title')}</h3>
          <p class="vb-rules-text">{t('rules.example.setup')}</p>
          <ul class="vb-rules-list">
            {EXAMPLE_OUTCOMES.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
