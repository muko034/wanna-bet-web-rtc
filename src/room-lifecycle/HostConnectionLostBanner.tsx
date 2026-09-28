type Props = {
  onDismiss: () => void;
};

/**
 * Shown at the App level, over whichever screen is mounted, once the Host's own foreground
 * recovery (`PeerJsTransport.recover()`, driven by `app.tsx`'s visibilitychange effect) has
 * exhausted both `peer.reconnect()` and its fresh-`Peer` fallback. Unlike the automatic-retry
 * states elsewhere in this app, there is nothing left to retry automatically here — the
 * signaling connection is gone for good until the page reloads — so this stays up until the
 * Host dismisses it rather than resolving itself.
 */
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
