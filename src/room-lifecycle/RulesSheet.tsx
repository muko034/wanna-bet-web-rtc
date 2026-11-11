import { useT } from '../i18n/LanguageContext';
import type { MessageKey } from '../i18n/dictionaries';

const FLOW_STEPS: MessageKey[] = ['rules.flow.challenger', 'rules.flow.bets', 'rules.flow.judge', 'rules.flow.points'];
const POINTS_RULES: MessageKey[] = ['rules.points.bettors', 'rules.points.yes', 'rules.points.no', 'rules.points.floor'];

type ExampleRow = {
  name: string;
  bet: { amount: number; prediction: 'YES' | 'NO' } | null;
  onSuccess: number;
  onFail: number;
};

/** The one fixed worked example: Anna is the Challenger, so N = 80 (NO Bets) and Y = 30 (YES Bets). */
const EXAMPLE_ROWS: ExampleRow[] = [
  { name: 'Anna', bet: null, onSuccess: 40, onFail: -15 },
  { name: 'Ben', bet: { amount: 30, prediction: 'YES' }, onSuccess: 30, onFail: -30 },
  { name: 'Cleo', bet: { amount: 50, prediction: 'NO' }, onSuccess: -50, onFail: 50 },
  { name: 'Dan', bet: { amount: 30, prediction: 'NO' }, onSuccess: -30, onFail: 30 },
];

/** A signed Points change, coloured by its sign like the Result Screen's deltas. */
function Delta({ points }: { points: number }) {
  return <td class={`vb-delta ${points >= 0 ? 'pos' : 'neg'}`}>{`${points >= 0 ? '+' : '−'}${Math.abs(points)}`}</td>;
}

/** Renders `**word**` markers in a copy string as bold text. */
function Emphasis({ text }: { text: string }) {
  return (
    <>
      {text.split('**').map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : part))}
    </>
  );
}

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
              <li key={key}>
                <Emphasis text={t(key)} />
              </li>
            ))}
          </ol>
        </section>
        <section class="vb-rules-section">
          <h3 class="vb-rules-heading">{t('rules.points.title')}</h3>
          <ul class="vb-rules-list">
            {POINTS_RULES.map((key) => (
              <li key={key}>
                <Emphasis text={t(key)} />
              </li>
            ))}
          </ul>
        </section>
        <section class="vb-rules-section">
          <h3 class="vb-rules-heading">{t('rules.example.title')}</h3>
          <table class="vb-rules-table">
            <thead>
              <tr>
                <th scope="col">{t('rules.example.player')}</th>
                <th scope="col">{t('rules.example.bet')}</th>
                <th scope="col">{t('rules.example.success')}</th>
                <th scope="col">{t('rules.example.fail')}</th>
              </tr>
            </thead>
            <tbody>
              {EXAMPLE_ROWS.map((row) => (
                <tr key={row.name}>
                  <th scope="row">{row.name}</th>
                  <td>{row.bet ? `${row.bet.amount} ${t(row.bet.prediction === 'YES' ? 'betting.yes' : 'betting.no')}` : t('rules.example.challenger')}</td>
                  <Delta points={row.onSuccess} />
                  <Delta points={row.onFail} />
                </tr>
              ))}
            </tbody>
          </table>
          <p class="vb-rules-text">{t('rules.example.totals')}</p>
        </section>
      </div>
    </div>
  );
}
