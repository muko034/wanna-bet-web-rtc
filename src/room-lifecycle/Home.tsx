import { PhoneShell } from '../PhoneShell';
import { withBase } from '../base-path';
import { useT } from '../i18n/LanguageContext';

/** Landing view: lets a player create a Room, or join one via a Room Code. */
export function Home(_props: { path?: string }) {
  const t = useT();
  return (
    <PhoneShell background="vb-bg-home">
      <div class="vb-eyebrow2">Wanna Bet</div>
      <div class="vb-giant-title">
        {t('home.title')}
      </div>
      <div class="vb-giant-sub">{t('home.subtitle')}</div>
      <a class="vb-cta" href={withBase('room')}>
        {t('home.create')}
      </a>
      <a class="vb-cta-outline" href={withBase('join')}>
        {t('home.join')}
      </a>
    </PhoneShell>
  );
}
