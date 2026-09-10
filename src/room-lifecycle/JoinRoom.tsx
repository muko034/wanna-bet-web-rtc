import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { PhoneShell } from '../PhoneShell';
import { PeerJsTransport } from '../transport/peerjs-transport';
import { joinRoom, type JoinResult } from './join-room';
import { roomRegistry } from './room-registry-instance';

type Props = {
  path?: string;
  code?: string;
};

type Status =
  | { kind: 'form' }
  | { kind: 'joining' }
  | { kind: 'joined' }
  | { kind: 'error'; message: string };

const ERROR_MESSAGES: Record<Exclude<JoinResult['status'], 'joined'>, string> = {
  'invalid-room': "This room link doesn't exist or has expired.",
  unreachable: "Couldn't reach the Host — check the link and try again.",
  'room-full': 'This Room is already full (20 players).',
};

/**
 * `/room/<CODE>`, shown to an unrecognized visitor (not this device's own Host Room): the
 * Guest join form. Enters a display name and connects directly to the Host over the
 * `Transport` interface.
 */
export function JoinRoom({ code }: Props) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'form' });

  const handleSubmit = (event: JSX.TargetedEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!code) return;
    setStatus({ kind: 'joining' });
    joinRoom(new PeerJsTransport(), roomRegistry, code, name).then((result) => {
      if (result.status === 'joined') {
        setStatus({ kind: 'joined' });
      } else {
        setStatus({ kind: 'error', message: ERROR_MESSAGES[result.status] });
      }
    });
  };

  if (status.kind === 'joined') {
    return (
      <PhoneShell background="vb-bg-wait" roomCode={code}>
        <div class="vb-giant-title" style="font-size:24px">
          You're in!
        </div>
        <div class="vb-giant-sub">Waiting for the Host to start the game.</div>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell background="vb-bg-form">
      <div class="vb-giant-title" style="font-size:24px">
        Join room {code}
      </div>
      <div class="vb-giant-sub">Enter your name to connect.</div>
      {status.kind === 'error' && <div class="vb-status-pill">{status.message}</div>}
      <form onSubmit={handleSubmit} style="width: 100%">
        <input
          class="vb-input-white"
          placeholder="Your name"
          autofocus
          value={name}
          onInput={(event) => setName((event.target as HTMLInputElement).value)}
          required
        />
        <button class="vb-cta" type="submit" disabled={status.kind === 'joining'}>
          {status.kind === 'joining' ? 'Joining…' : 'Join room'}
        </button>
      </form>
    </PhoneShell>
  );
}
