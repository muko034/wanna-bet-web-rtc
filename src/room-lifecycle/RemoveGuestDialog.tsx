import { useT } from '../i18n/LanguageContext';

type Props = {
  /** The player the Host is about to remove, named in the title. */
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** The Host's confirm step before a Remove, shared by the Leaderboard sheet and the Lobby roster. */
export function RemoveGuestDialog({ name, onConfirm, onCancel }: Props) {
  const t = useT();
  const title = t('removeGuest.title', { name });
  return (
    <div class="vb-rank-sheet-backdrop vb-dialog-backdrop" onClick={onCancel}>
      <div class="vb-dialog" role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div class="vb-dialog-title">{title}</div>
        <button class="vb-dialog-destructive" type="button" onClick={onConfirm}>
          {t('hostMenu.remove')}
        </button>
        <button class="vb-dialog-link" type="button" onClick={onCancel}>
          {t('homeDialog.cancel')}
        </button>
      </div>
    </div>
  );
}
