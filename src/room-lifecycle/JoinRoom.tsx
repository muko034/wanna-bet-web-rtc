import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { route } from 'preact-router';
import { PhoneShell } from '../PhoneShell';
import { withBase } from '../base-path';
import { PeerJsTransport } from '../transport/peerjs-transport';
import { joinRoom, type JoinResult } from './join-room';
import { attemptReconnect, completeGuestConnection, wireGuestConnection, type ReconnectCallbacks } from './guest-reconnect';
import { loadIdentity } from './player-identity';
import { resolveLobbyRoster } from './lobby-roster';
import { ReconnectingScreen } from './ReconnectingScreen';
import { roomRegistry } from './room-registry-instance';
import type { GameState, PlaceBetPayload } from '../protocol/messages';

type Props = {
  path?: string;
  code?: string;
  /** Notifies the caller that this Guest observed the Host's game-started broadcast for `code`, since a Guest holds no local `Room` for `StartedGame` to read. */
  onGameStarted: (code: string) => void;
  onGameState: (state: GameState) => void;
  /** This Guest's own live `GameState` — a Lobby snapshot pre-game — used only for the waiting screen's roster. */
  gameState: GameState | null;
  onPlaceBetReady: (placeBet: ((payload: PlaceBetPayload) => void) | null) => void;
};

type Status =
  | { kind: 'form' }
  | { kind: 'rejoining' }
  | { kind: 'joining' }
  | { kind: 'joined'; playerId: string }
  | { kind: 'session-ended' }
  | { kind: 'error'; message: string }
  | { kind: 'reconnect-failed' };

const ERROR_MESSAGES: Record<Exclude<JoinResult['status'], 'joined'>, string> = {
  'invalid-room': "This room link doesn't exist or has expired.",
  unreachable: "Couldn't reach the Host — check the link and try again.",
  'room-full': 'This Room is already full (20 players).',
  'game-started': 'This game has already started.',
};

/**
 * `/room/<CODE>`, shown to an unrecognized visitor (not this device's own Host Room): the
 * Guest join form. Enters a display name and connects directly to the Host over the
 * `Transport` interface. If this device already holds a stored identity for `code` (a
 * prior join, before a dropped connection or page reload), it presents that
 * `reconnectToken` via `rejoinRoom` instead, skipping the name prompt so the Guest resumes
 * as their same existing player.
 */
export function JoinRoom({ code, onGameStarted, onGameState, gameState, onPlaceBetReady }: Props) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'form' });
  // Bumped by the "can't reach the Host" state's Retry button, to re-run the reconnect
  // effect below from scratch (including its own automatic retry budget) rather than a
  // single bare attempt.
  const [retryKey, setRetryKey] = useState(0);

  // Read through a ref so the effects below depend on `code` alone: a caller passing a fresh
  // callback per render must not re-run them, since each run opens a new Peer.
  const callbacksRef = useRef({ onGameStarted, onGameState, onPlaceBetReady });
  callbacksRef.current = { onGameStarted, onGameState, onPlaceBetReady };

  /** Builds the callbacks a live connection (fresh join or rejoin) reports back to. */
  const makeCallbacks = (): ReconnectCallbacks => ({
    onGameState: (state) => callbacksRef.current.onGameState(state),
    onGameStarted: (startedCode) => {
      callbacksRef.current.onGameStarted(startedCode);
      route(withBase(`room/${startedCode}/play`));
    },
    onSessionEnded: () => {
      callbacksRef.current.onPlaceBetReady(null);
      setStatus({ kind: 'session-ended' });
    },
    onPlaceBetReady: (placeBet) => callbacksRef.current.onPlaceBetReady(placeBet),
  });

  useEffect(() => {
    if (!code) return;
    const stored = loadIdentity(localStorage, code);
    if (!stored) return;

    setStatus({ kind: 'rejoining' });
    const transport = new PeerJsTransport();
    let pending = true;
    attemptReconnect(transport, roomRegistry, localStorage, code, makeCallbacks()).then((result) => {
      if (!pending) return;
      pending = false;
      if (result.status === 'joined') {
        setStatus({ kind: 'joined', playerId: result.playerId });
      } else if (result.status === 'unknown-player') {
        callbacksRef.current.onPlaceBetReady(null);
        setStatus({ kind: 'form' });
      } else if (result.status === 'unreachable') {
        callbacksRef.current.onPlaceBetReady(null);
        setStatus({ kind: 'reconnect-failed' });
      } else if (result.status !== 'no-identity') {
        callbacksRef.current.onPlaceBetReady(null);
        setStatus({ kind: 'error', message: ERROR_MESSAGES[result.status] });
      }
    });

    // Only abandon a rejoin still in flight: a joined transport is the live game connection
    // and must outlive this screen (it unmounts when the Guest routes to `/play`).
    return () => {
      if (pending) {
        pending = false;
        transport.close();
      }
    };
  }, [code, retryKey]);

  const handleSubmit = (event: JSX.TargetedEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!code) return;
    setStatus({ kind: 'joining' });
    const transport = new PeerJsTransport();
    const callbacks = makeCallbacks();
    wireGuestConnection(transport, code, callbacks);
    joinRoom(transport, roomRegistry, code, name).then((result) => {
      if (result.status === 'joined') {
        completeGuestConnection(transport, code, localStorage, result.playerId, result.reconnectToken, callbacks);
        setStatus({ kind: 'joined', playerId: result.playerId });
      } else {
        callbacksRef.current.onPlaceBetReady(null);
        setStatus({ kind: 'error', message: ERROR_MESSAGES[result.status] });
      }
    });
  };

  if (status.kind === 'session-ended') {
    return (
      <PhoneShell background="vb-bg-wait" roomCode={code}>
        <div class="vb-giant-title" style="font-size:24px">
          Session ended
        </div>
        <div class="vb-giant-sub">The Host's connection was lost, so this Room has ended.</div>
      </PhoneShell>
    );
  }

  if (status.kind === 'joined') {
    const roster = resolveLobbyRoster({ players: gameState?.players ?? null, localPlayerId: status.playerId });
    return (
      <PhoneShell background="vb-bg-wait" roomCode={code}>
        <div class="vb-giant-title" style="font-size:24px">
          You're in!
        </div>
        <div class="vb-giant-sub">Waiting for the Host to start the game.</div>
        <div class="vb-avatar-row">
          {roster.map((entry) => (
            <div class="vb-avatar" key={entry.playerId}>
              {entry.nameLabel}
            </div>
          ))}
        </div>
      </PhoneShell>
    );
  }

  if (status.kind === 'rejoining') {
    return <ReconnectingScreen roomCode={code} />;
  }

  if (status.kind === 'reconnect-failed') {
    return (
      <PhoneShell background="vb-bg-wait" roomCode={code}>
        <div class="vb-giant-title" style="font-size:24px">
          Can't reach the Host
        </div>
        <div class="vb-giant-sub">{ERROR_MESSAGES.unreachable}</div>
        <button class="vb-cta" type="button" onClick={() => setRetryKey((key) => key + 1)}>
          Retry
        </button>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell background="vb-bg-form">
      <div class="vb-giant-title" style="font-size:24px">
        Join room {code}
      </div>
      <div class="vb-giant-sub">Enter your name to connect.</div>
      {status.kind === 'error' && <div class="vb-status-pill">{status.message}</div>}
      <form onSubmit={handleSubmit} style="width: 100%">
        <input
          class="vb-input-white"
          placeholder="Your name"
          autofocus
          value={name}
          onInput={(event) => setName((event.target as HTMLInputElement).value)}
          required
        />
        <button class="vb-cta" type="submit" disabled={status.kind === 'joining'}>
          {status.kind === 'joining' ? 'Joining…' : 'Join room'}
        </button>
      </form>
    </PhoneShell>
  );
}
