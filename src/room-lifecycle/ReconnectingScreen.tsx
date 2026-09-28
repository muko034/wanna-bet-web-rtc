import { useEffect, useState } from 'preact/hooks';
import { PhoneShell } from '../PhoneShell';
import { REASSURANCE_DELAY_MS, resolveReconnectingMessage } from './reconnecting-message';

type Props = {
  roomCode?: string;
};

/**
 * The full-screen "Reconnecting…" state shown while a Guest's shared reconnect attempt
 * (`attemptReconnect`, in `guest-reconnect.ts`) is in flight — on either the Lobby's join
 * screen or `/room/<code>/play`, so a Guest is never left looking at a stale game/lobby
 * screen while disconnected. Its copy switches to a reassurance message (`resolveReconnectingMessage`)
 * once the attempt has been running for a while, so a Guest waiting out the multi-minute
 * automatic retry window sees something other than a static label the whole time. Mounts
 * once per attempt (a fresh manual Retry remounts it), so its elapsed-time clock always
 * starts from zero for the attempt currently showing.
 */
export function ReconnectingScreen({ roomCode }: Props) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setElapsedMs(REASSURANCE_DELAY_MS), REASSURANCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <PhoneShell background="vb-bg-wait" roomCode={roomCode}>
      <div class="vb-giant-title" style="font-size:24px">
        {resolveReconnectingMessage(elapsedMs)}
      </div>
    </PhoneShell>
  );
}
