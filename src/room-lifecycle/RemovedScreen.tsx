import { PhoneShell } from '../PhoneShell';
import { useT } from '../i18n/LanguageContext';
import { withBase } from '../base-path';

/** What the Host's removed Guest sees, in the Lobby and in the Game: why, and one way back to Home. */
export function RemovedScreen({ roomCode }: { roomCode?: string }) {
  const t = useT();
  return (
    <PhoneShell background="vb-bg-wait" roomCode={roomCode}>
      <div class="vb-giant-title">{t('removed.title')}</div>
      <a class="vb-cta" href={withBase('/')}>
        {t('gameResult.home')}
      </a>
    </PhoneShell>
  );
}
