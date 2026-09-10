import { PhoneShell } from '../PhoneShell';

/** Landing view: lets a player create a Room. Joining is not yet wired up. */
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
      <a class="vb-cta" href="/room">
        Create a game
      </a>
      <button class="vb-cta-outline" type="button" disabled title="Joining a game isn't available yet">
        Join a game
      </button>
    </PhoneShell>
  );
}
