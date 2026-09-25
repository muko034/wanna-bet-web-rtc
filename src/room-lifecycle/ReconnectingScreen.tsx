import { PhoneShell } from '../PhoneShell';

type Props = {
  roomCode?: string;
};

/**
 * The full-screen "Reconnecting…" state shown while a Guest's shared reconnect attempt
 * (`attemptReconnect`, in `guest-reconnect.ts`) is in flight — on either the Lobby's join
 * screen or `/room/<code>/play`, so a Guest is never left looking at a stale game/lobby
 * screen while disconnected.
 */
export function ReconnectingScreen({ roomCode }: Props) {
  return (
    <PhoneShell background="vb-bg-wait" roomCode={roomCode}>
      <div class="vb-giant-title" style="font-size:24px">
        Reconnecting…
      </div>
    </PhoneShell>
  );
}
