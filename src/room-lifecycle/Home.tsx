import { PhoneShell } from '../PhoneShell';
import { withBase } from '../base-path';

/** Landing view: lets a player create a Room, or join one via a Room Code. */
export function Home(_props: { path?: string }) {
  return (
    <PhoneShell background="vb-bg-home">
      <div class="vb-eyebrow2">Wanna Bet</div>
      <div class="vb-giant-title">
        Ready to
        <br />
        play?
      </div>
      <div class="vb-giant-sub">Create a room for your friends, or join one with a code.</div>
      <a class="vb-cta" href={withBase('room')}>
        Create a game
      </a>
      <a class="vb-cta-outline" href={withBase('join')}>
        Join a game
      </a>
    </PhoneShell>
  );
}
