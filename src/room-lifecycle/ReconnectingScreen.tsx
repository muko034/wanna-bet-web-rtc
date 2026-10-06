import { useEffect, useState } from 'preact/hooks';
import { PhoneShell } from '../PhoneShell';
import { useT } from '../i18n/LanguageContext';
import { REASSURANCE_DELAY_MS, resolveReconnectingMessage } from './reconnecting-message';

type Props = {
  roomCode?: string;
};

/**
 * The full-screen "Reconnecting…" state shown while a Guest's shared reconnect attempt
 * (`attemptReconnect`, in `guest-reconnect.ts`) is in flight — on either the Lobby's join
 * screen or `/room/<code>/play`, so a Guest is never left looking at a stale game/lobby
 * screen while disconnected. Switches to a reassurance message once the attempt has run a
 * while. Remounts per attempt, so the elapsed clock restarts.
 */
export function ReconnectingScreen({ roomCode }: Props) {
  const t = useT();
  const [elapsedMs, setElapsedMs] = useState(0);
  const message = resolveReconnectingMessage(elapsedMs);

  useEffect(() => {
    const timer = setTimeout(() => setElapsedMs(REASSURANCE_DELAY_MS), REASSURANCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <PhoneShell background="vb-bg-wait" roomCode={roomCode}>
      <div class="vb-giant-title" style="font-size:24px">
        {t(message.key, message.params)}
      </div>
    </PhoneShell>
  );
}
