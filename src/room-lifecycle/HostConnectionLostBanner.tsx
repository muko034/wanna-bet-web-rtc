import { useT } from '../i18n/LanguageContext';

type Props = {
  onDismiss: () => void;
};

/** Shown over whichever screen is mounted when Host recovery fails. Stays until dismissed or a later recovery succeeds. */
export function HostConnectionLostBanner({ onDismiss }: Props) {
  const t = useT();
  return (
    <div class="vb-host-recovery-banner">
      <span>{t('hostLost.message')}</span>
      <button type="button" onClick={() => window.location.reload()}>
        {t('hostLost.reload')}
      </button>
      <button type="button" aria-label="Dismiss" onClick={onDismiss}>
        ✕
      </button>
    </div>
  );
}
