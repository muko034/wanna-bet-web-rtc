import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { PhoneShell } from '../PhoneShell';
import { PeerJsTransport } from '../transport/peerjs-transport';
import { joinRoom, rejoinRoom, watchForSessionEnd, type JoinResult } from './join-room';
import { loadIdentity, saveIdentity } from './player-identity';
import { roomRegistry } from './room-registry-instance';

type Props = {
  path?: string;
  code?: string;
};

type Status =
  | { kind: 'form' }
  | { kind: 'rejoining' }
  | { kind: 'joining' }
  | { kind: 'joined' }
  | { kind: 'session-ended' }
  | { kind: 'error'; message: string };

const ERROR_MESSAGES: Record<Exclude<JoinResult['status'], 'joined'>, string> = {
  'invalid-room': "This room link doesn't exist or has expired.",
  unreachable: "Couldn't reach the Host — check the link and try again.",
  'room-full': 'This Room is already full (20 players).',
};

/**
 * `/room/<CODE>`, shown to an unrecognized visitor (not this device's own Host Room): the
 * Guest join form. Enters a display name and connects directly to the Host over the
 * `Transport` interface. If this device already holds a stored identity for `code` (a
 * prior join, before a dropped connection or page reload), it presents that
 * `reconnectToken` via `rejoinRoom` instead, skipping the name prompt so the Guest resumes
 * as their same existing player.
 */
export function JoinRoom({ code }: Props) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'form' });

  useEffect(() => {
    if (!code) return;
    const stored = loadIdentity(localStorage, code);
    if (!stored) return;

    setStatus({ kind: 'rejoining' });
    const transport = new PeerJsTransport();
    rejoinRoom(transport, roomRegistry, code, stored.reconnectToken).then((result) => {
      if (result.status === 'joined') {
        saveIdentity(localStorage, code, { playerId: result.playerId, reconnectToken: result.reconnectToken });
        setStatus({ kind: 'joined' });
        watchForSessionEnd(transport, () => setStatus({ kind: 'session-ended' }));
      } else if (result.status === 'unknown-player') {
        setStatus({ kind: 'form' });
      } else {
        setStatus({ kind: 'error', message: ERROR_MESSAGES[result.status] });
      }
    });
  }, [code]);

  const handleSubmit = (event: JSX.TargetedEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!code) return;
    setStatus({ kind: 'joining' });
    const transport = new PeerJsTransport();
    joinRoom(transport, roomRegistry, code, name).then((result) => {
      if (result.status === 'joined') {
        saveIdentity(localStorage, code, { playerId: result.playerId, reconnectToken: result.reconnectToken });
        setStatus({ kind: 'joined' });
        watchForSessionEnd(transport, () => setStatus({ kind: 'session-ended' }));
      } else {
        setStatus({ kind: 'error', message: ERROR_MESSAGES[result.status] });
      }
    });
  };

  if (status.kind === 'session-ended') {
    return (
      <PhoneShell background="vb-bg-wait" roomCode={code}>
        <div class="vb-giant-title" style="font-size:24px">
          Session ended
        </div>
        <div class="vb-giant-sub">The Host's connection was lost, so this Room has ended.</div>
      </PhoneShell>
    );
  }

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

  if (status.kind === 'rejoining') {
    return (
      <PhoneShell background="vb-bg-wait" roomCode={code}>
        <div class="vb-giant-title" style="font-size:24px">
          Reconnecting…
        </div>
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
