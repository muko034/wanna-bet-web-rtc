type Props = {
  onDismiss: () => void;
};

/** Shown over whichever screen is mounted when Host recovery fails. Stays until dismissed or a later recovery succeeds. */
export function HostConnectionLostBanner({ onDismiss }: Props) {
  return (
    <div class="vb-host-recovery-banner">
      <span>Lost the connection to your players. Reload this page to reconnect them.</span>
      <button type="button" onClick={() => window.location.reload()}>
        Reload
      </button>
      <button type="button" aria-label="Dismiss" onClick={onDismiss}>
        ✕
      </button>
    </div>
  );
}
