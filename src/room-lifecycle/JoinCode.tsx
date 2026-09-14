import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { route } from 'preact-router';
import { PhoneShell } from '../PhoneShell';

type Props = {
  path?: string;
};

/** `/join`: asks for the Room Code, then hands off to the existing `/room/<CODE>` Guest join flow. */
export function JoinCode(_props: Props) {
  const [code, setCode] = useState('');

  const handleSubmit = (event: JSX.TargetedEvent<HTMLFormElement>) => {
    event.preventDefault();
    route(`/room/${code.trim().toUpperCase()}`);
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
        Join a game
      </div>
      <div class="vb-giant-sub">Enter the room code.</div>
      <form onSubmit={handleSubmit} style="width: 100%">
        <input
          class="vb-input-white"
          placeholder="Room code"
          style="text-transform:uppercase"
          autofocus
          value={code}
          onInput={(event) => setCode((event.target as HTMLInputElement).value)}
          required
        />
        <button class="vb-cta" type="submit">
          Continue
        </button>
      </form>
    </PhoneShell>
  );
}
