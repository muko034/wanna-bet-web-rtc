import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { PhoneShell } from '../PhoneShell';
import { useT } from '../i18n/LanguageContext';
import { createPeerJsTransport } from '../transport/create-peerjs-transport';
import type { RecoverableTransport } from '../transport/transport';
import { createRoom, type Room } from './room';
import { roomRegistry } from './room-registry-instance';

type Props = {
  path?: string;
  onRoomCreated: (room: Room, transport: RecoverableTransport) => void;
};

/** `/room`: form to enter the Host's display name and create the Room. */
export function CreateRoom({ onRoomCreated }: Props) {
  const t = useT();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = (event: JSX.TargetedEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    const transport = createPeerJsTransport();
    createRoom(transport, roomRegistry, name).then((room) => onRoomCreated(room, transport));
  };

  return (
    <PhoneShell background="vb-bg-form">
      <div class="vb-giant-title" style="font-size:24px">
        {t('createRoom.title')}
      </div>
      <div class="vb-giant-sub">{t('createRoom.subtitle')}</div>
      <form onSubmit={handleSubmit} style="width: 100%">
        <input
          class="vb-input-white"
          placeholder={t('form.namePlaceholder')}
          autofocus
          value={name}
          onInput={(event) => setName((event.target as HTMLInputElement).value)}
          required
        />
        <button class="vb-cta" type="submit" disabled={creating}>
          {creating ? t('createRoom.submitting') : t('createRoom.submit')}
        </button>
      </form>
    </PhoneShell>
  );
}
