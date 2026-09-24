import { PhoneShell } from '../PhoneShell';

type Props = {
  roomCode: string;
  failed: boolean;
  onRetry: () => void;
};

/** Shown while a Host's saved Room is being reclaimed after a reload, or once reclaiming it gave up. */
export function ReopeningRoom({ roomCode, failed, onRetry }: Props) {
  if (!failed) {
    return (
      <PhoneShell background="vb-bg-home" roomCode={roomCode}>
        <div class="vb-giant-title vb-title-small">Reopening your Room…</div>
        <div class="vb-giant-sub">After a crash this can take up to a minute.</div>
      </PhoneShell>
    );
  }
  return (
    <PhoneShell background="vb-bg-home" roomCode={roomCode}>
      <div class="vb-giant-title vb-title-small">Couldn't reopen your Room</div>
      <button class="vb-cta" type="button" onClick={onRetry}>
        Retry
      </button>
    </PhoneShell>
  );
}
