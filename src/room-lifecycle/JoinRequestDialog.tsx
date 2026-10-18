import { useT } from '../i18n/LanguageContext';

type Props = {
  /** The Guest asking to join. */
  name: string;
  onApprove: () => void;
  onDecline: () => void;
  /** Dismisses the dialog without answering: the request keeps waiting. */
  onClose: () => void;
};

/** The Host's decision on one Join Request to the started Game. */
export function JoinRequestDialog({ name, onApprove, onDecline, onClose }: Props) {
  const t = useT();
  const title = t('joinRequest.title', { name });
  return (
    <div class="vb-rank-sheet-backdrop vb-dialog-backdrop" onClick={onClose}>
      <div class="vb-dialog" role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div class="vb-dialog-title">{title}</div>
        <button class="vb-cta" type="button" onClick={onApprove}>
          {t('joinRequest.approve')}
        </button>
        <button class="vb-dialog-destructive" type="button" onClick={onDecline}>
          {t('joinRequest.decline')}
        </button>
      </div>
    </div>
  );
}
