import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { PhoneShell } from '../PhoneShell';
import { PeerJsTransport } from '../transport/peerjs-transport';
import { createRoom, type Room } from './room';
import { roomRegistry } from './room-registry-instance';

type Props = {
  path?: string;
  onRoomCreated: (room: Room) => void;
};

/** `/room`: form to enter the Host's display name and create the Room. */
export function CreateRoom({ onRoomCreated }: Props) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = (event: JSX.TargetedEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    createRoom(new PeerJsTransport(), roomRegistry).then(onRoomCreated);
  };

  return (
    <PhoneShell
      background="vb-bg-form"
      topLeft={
        <a class="vb-back-fab" href="/">
          &larr;
        </a>
      }
    >
      <div class="vb-giant-title" style="font-size:24px">
        Create a game
      </div>
      <div class="vb-giant-sub">Pick a name — you'll get a room code to share.</div>
      <form onSubmit={handleSubmit} style="width: 100%">
        <input
          class="vb-input-white"
          placeholder="Your name"
          autofocus
          value={name}
          onInput={(event) => setName((event.target as HTMLInputElement).value)}
          required
        />
        <button class="vb-cta" type="submit" disabled={creating}>
          {creating ? 'Creating…' : 'Create room'}
        </button>
      </form>
    </PhoneShell>
  );
}
