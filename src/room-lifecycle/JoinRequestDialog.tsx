import { useState } from 'preact/hooks';
import { useT } from '../i18n/LanguageContext';
import { parseJoinPoints } from './join-points';

type Props = {
  /** The Guest asking to join. */
  name: string;
  /** The Points the field starts with. */
  defaultPoints: number;
  /** Admits the Guest with the Points the Host chose; only called with a valid value. */
  onApprove: (points: number) => void;
  onDecline: () => void;
  /** Dismisses the dialog without answering: the request keeps waiting. */
  onClose: () => void;
};

/** The Host's decision on one Join Request to the started Game. */
export function JoinRequestDialog({ name, defaultPoints, onApprove, onDecline, onClose }: Props) {
  const t = useT();
  const title = t('joinRequest.title', { name });
  const [pointsText, setPointsText] = useState(String(defaultPoints));
  const points = parseJoinPoints(pointsText);
  return (
    <div class="vb-rank-sheet-backdrop vb-dialog-backdrop" onClick={onClose}>
      <div class="vb-dialog" role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div class="vb-dialog-title">{title}</div>
        <label class="vb-dialog-field">
          <span>{t('joinRequest.points')}</span>
          <input
            class="vb-input-white"
            type="text"
            inputMode="numeric"
            value={pointsText}
            aria-invalid={points === null}
            onInput={(event) => setPointsText((event.target as HTMLInputElement).value)}
          />
        </label>
        {points === null && <div class="vb-dialog-error">{t('joinRequest.points.invalid')}</div>}
        <button class="vb-cta" type="button" disabled={points === null} onClick={() => points !== null && onApprove(points)}>
          {t('joinRequest.approve')}
        </button>
        <button class="vb-dialog-destructive" type="button" onClick={onDecline}>
          {t('joinRequest.decline')}
        </button>
      </div>
    </div>
  );
}
