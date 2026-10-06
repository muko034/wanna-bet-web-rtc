import { PhoneShell } from '../PhoneShell';
import { useT } from '../i18n/LanguageContext';

type Props = {
  roomCode: string;
  failed: boolean;
  onRetry: () => void;
  onHome: () => void;
};

/** Shown while a Host's saved Room is being reclaimed after a reload, or once reclaiming it gave up. */
export function ReopeningRoom({ roomCode, failed, onRetry, onHome }: Props) {
  const t = useT();
  if (!failed) {
    return (
      <PhoneShell background="vb-bg-home" roomCode={roomCode} onHome={onHome}>
        <div class="vb-giant-title vb-title-small">{t('reopening.title')}</div>
        <div class="vb-giant-sub">{t('reopening.subtitle')}</div>
      </PhoneShell>
    );
  }
  return (
    <PhoneShell background="vb-bg-home" roomCode={roomCode} onHome={onHome}>
      <div class="vb-giant-title vb-title-small">{t('reopening.failedTitle')}</div>
      <button class="vb-cta" type="button" onClick={onRetry}>
        {t('reopening.retry')}
      </button>
    </PhoneShell>
  );
}
