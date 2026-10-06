import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { route } from 'preact-router';
import { PhoneShell } from '../PhoneShell';
import { useT } from '../i18n/LanguageContext';
import { withBase } from '../base-path';
import { extractRoomCode } from './extract-room-code';

type Props = {
  path?: string;
};

/** `/join`: asks for the Room Code, then hands off to the existing `/room/<CODE>` Guest join flow. */
export function JoinCode(_props: Props) {
  const t = useT();
  const [code, setCode] = useState('');

  const handleSubmit = (event: JSX.TargetedEvent<HTMLFormElement>) => {
    event.preventDefault();
    route(withBase(`room/${code}`));
  };

  return (
    <PhoneShell background="vb-bg-form">
      <div class="vb-giant-title" style="font-size:24px">
        {t('joinCode.title')}
      </div>
      <div class="vb-giant-sub">{t('joinCode.subtitle')}</div>
      <form onSubmit={handleSubmit} style="width: 100%">
        <input
          class="vb-input-white"
          placeholder={t('joinCode.placeholder')}
          style="text-transform:uppercase"
          autofocus
          value={code}
          onInput={(event) => setCode(extractRoomCode((event.target as HTMLInputElement).value))}
          required
        />
        <button class="vb-cta" type="submit">
          {t('joinCode.submit')}
        </button>
      </form>
    </PhoneShell>
  );
}
