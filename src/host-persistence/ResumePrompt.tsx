import { PhoneShell } from '../PhoneShell';

type Props = {
  roomCode: string;
  resuming: boolean;
  error: string | null;
  onResume: () => void;
  onDecline: () => void;
};

/** Offers the Host to pick a saved in-progress session back up, or start fresh instead. */
export function ResumePrompt({ roomCode, resuming, error, onResume, onDecline }: Props) {
  return (
    <PhoneShell background="vb-bg-home" roomCode={roomCode}>
      <div class="vb-giant-title" style="font-size:24px">
        Resume this session?
      </div>
      <div class="vb-giant-sub">Your game is still in progress.</div>
      {error && <div class="vb-status-pill">{error}</div>}
      <button class="vb-cta" type="button" disabled={resuming} onClick={onResume}>
        {resuming ? 'Resuming…' : 'Resume'}
      </button>
      <button class="vb-cta-outline" type="button" disabled={resuming} onClick={onDecline}>
        Start fresh
      </button>
    </PhoneShell>
  );
}
