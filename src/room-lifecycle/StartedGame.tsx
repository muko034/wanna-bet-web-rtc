import { route } from 'preact-router';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { PhoneShell } from '../PhoneShell';
import { NotFound } from '../NotFound';
import { withBase } from '../base-path';
import { challengeBank } from '../challenge-bank/challenge-bank';
import { PeerJsTransport } from '../transport/peerjs-transport';
import type { GameState, Prediction, PlaceBetPayload } from '../protocol/messages';
import { loadIdentity } from './player-identity';
import { attemptReconnect, type ReconnectCallbacks } from './guest-reconnect';
import { resolveChallengeCard } from './challenge-card';
import { resolveBettingPanel } from './betting-panel';
import { deriveResultMemory, dismissResult, resolveResultScreen, type ResultMemory } from './result-screen';
import { JoinRoom } from './JoinRoom';
import { ReconnectingScreen } from './ReconnectingScreen';
import { resolveRoundControls } from './round-controls';
import { resolveStartedGameView, type ReconnectPhase } from './started-game-view';
import { roomRegistry } from './room-registry-instance';
import type { Room } from './room';

const RECONNECT_ERROR_MESSAGES: Record<'invalid-room' | 'unreachable', string> = {
  'invalid-room': "This room link doesn't exist or has expired.",
  unreachable: "Couldn't reach the Host — check the link and try again.",
};

type Props = {
  path?: string;
  code?: string;
  room: Room | null;
  /** The Room Code for which this Guest has locally observed the Host's game-started broadcast — see `resolveStartedGameView`. */
  guestGameStartedCode: string | null;
  gameState: GameState | null;
  onPlaceBet: (payload: PlaceBetPayload) => void;
  onResolveRound: (outcome: Prediction) => void;
  /** Notifies the caller that this Guest observed the Host's game-started broadcast for `code`. */
  onGameStarted: (code: string) => void;
  onGameState: (state: GameState) => void;
  onPlaceBetReady: (placeBet: ((payload: PlaceBetPayload) => void) | null) => void;
};

/**
 * `/room/<CODE>/play`: the started-game view. Redirects the Host back to the Lobby if the
 * Host's own Room hasn't started; a Guest reaches this view via its own
 * `guestGameStartedCode` signal instead, since a Guest never holds a local `Room` object
 * (see `resolveStartedGameView`). While a round is open, it shows the Challenge card plus
 * per-Bettor public bet status, and it lets an eligible local Bettor submit a Bet.
 *
 * A Guest whose device has no live signal yet for this Room (a fresh page reload) drives the
 * same shared reconnect implementation used by the Lobby's join screen (`guest-reconnect.ts`)
 * in place here, rather than bouncing through the Lobby route or showing "Page not found".
 */
export function StartedGame({
  code,
  room,
  guestGameStartedCode,
  gameState,
  onPlaceBet,
  onResolveRound,
  onGameStarted,
  onGameState,
  onPlaceBetReady,
}: Props) {
  const [reconnectPhase, setReconnectPhase] = useState<ReconnectPhase>(null);
  const hasStoredIdentity = code !== undefined && loadIdentity(localStorage, code) !== null;
  const isGuestUnresolved = !(room !== null && room.code === code) && guestGameStartedCode !== code;

  // Read through a ref so the reconnect effect below depends on `code` alone: a caller
  // passing a fresh callback per render must not re-run it, since each run opens a new Peer.
  const callbacksRef = useRef({ onGameStarted, onGameState, onPlaceBetReady });
  callbacksRef.current = { onGameStarted, onGameState, onPlaceBetReady };

  useEffect(() => {
    if (!code || !isGuestUnresolved || !hasStoredIdentity) return;

    setReconnectPhase('pending');
    const transport = new PeerJsTransport();
    let pending = true;
    const callbacks: ReconnectCallbacks = {
      onGameState: (state) => callbacksRef.current.onGameState(state),
      onGameStarted: (startedCode) => callbacksRef.current.onGameStarted(startedCode),
      onSessionEnded: () => {
        callbacksRef.current.onPlaceBetReady(null);
        setReconnectPhase('session-ended');
      },
      onPlaceBetReady: (placeBet) => callbacksRef.current.onPlaceBetReady(placeBet),
    };
    attemptReconnect(transport, roomRegistry, localStorage, code, callbacks).then((result) => {
      if (!pending) return;
      pending = false;
      if (result.status === 'joined' || result.status === 'no-identity') {
        setReconnectPhase(null);
      } else if (result.status === 'unknown-player') {
        setReconnectPhase('unknown-player');
      } else {
        setReconnectPhase({ kind: 'error', message: RECONNECT_ERROR_MESSAGES[result.status] });
      }
    });

    // Only abandon a reconnect still in flight: a joined transport is the live game
    // connection and must outlive this effect.
    return () => {
      if (pending) {
        pending = false;
        transport.close();
      }
    };
  }, [code, isGuestUnresolved, hasStoredIdentity]);

  const view = resolveStartedGameView({ code, room, guestGameStartedCode, hasStoredIdentity, reconnectPhase });
  const [amount, setAmount] = useState(1);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [submittedBet, setSubmittedBet] = useState<{ roundKey: string; bet: PlaceBetPayload } | null>(null);
  // `null` until the first real `gameState` arrives: a Guest's reconnect resolves this
  // asynchronously, so seeding from `gameState` at mount (as the Host's synchronous resume can)
  // would seed from a not-yet-loaded `null` and then replay the next, already-past Resolution as new.
  const [storedResultMemory, setStoredResultMemory] = useState<ResultMemory | null>(null);
  // Pure and idempotent, so deriving it during render shows a new Resolution on the very frame it arrives.
  const resultMemory = deriveResultMemory(storedResultMemory, gameState);

  useEffect(() => {
    if (gameState !== null && resultMemory !== storedResultMemory) {
      setStoredResultMemory(resultMemory);
    }
  }, [gameState, resultMemory, storedResultMemory]);

  useEffect(() => {
    if (view.view === 'redirect-to-lobby') {
      route(withBase(`room/${code}`), true);
    }
  }, [view.view, code]);

  if (view.view === 'not-found') {
    return <NotFound />;
  }

  if (view.view === 'redirect-to-lobby') {
    return null;
  }

  if (view.view === 'join-form') {
    return (
      <JoinRoom
        code={code}
        onGameStarted={onGameStarted}
        onGameState={onGameState}
        gameState={gameState}
        onPlaceBetReady={onPlaceBetReady}
      />
    );
  }

  if (view.view === 'reconnecting') {
    return <ReconnectingScreen roomCode={view.roomCode} />;
  }

  if (view.view === 'session-ended') {
    return (
      <PhoneShell background="vb-bg-wait" roomCode={view.roomCode}>
        <div class="vb-giant-title" style="font-size:24px">
          Session ended
        </div>
        <div class="vb-giant-sub">The Host's connection was lost, so this Room has ended.</div>
      </PhoneShell>
    );
  }

  if (view.view === 'reconnect-failed') {
    return (
      <PhoneShell background="vb-bg-wait" roomCode={view.roomCode}>
        <div class="vb-giant-title" style="font-size:24px">
          Can't reach the Host
        </div>
        <div class="vb-giant-sub">{view.message}</div>
      </PhoneShell>
    );
  }

  const localPlayerId = room?.code === code
    ? room?.hostPlayerId
    : (code ? loadIdentity(localStorage, code)?.playerId : null);
  const roundKey = gameState?.round ? `${gameState.round.activePlayerId}:${gameState.round.challengeId}` : null;
  const localBet = submittedBet?.roundKey === roundKey ? submittedBet.bet : null;

  useEffect(() => {
    setSubmittedBet(null);
    setAmount(1);
    setPrediction(null);
  }, [roundKey]);

  const bettingPanel = useMemo(
    () => resolveBettingPanel({ gameState, localPlayerId: localPlayerId ?? null, localBet }),
    [gameState, localBet, localPlayerId],
  );
  const challengeCard = localPlayerId
    ? resolveChallengeCard({ gameState, localPlayerId, challengeBank, displayLanguage: 'pl' })
    : null;
  const roundControls = resolveRoundControls({ code, room, gameState });
  const resultScreen = resolveResultScreen({ memory: resultMemory, localPlayerId: localPlayerId ?? null });

  const handleLockIn = () => {
    if (!roundKey || prediction === null) {
      return;
    }
    onPlaceBet({ amount, prediction });
    setSubmittedBet({ roundKey, bet: { amount, prediction } });
  };

  if (resultScreen) {
    return (
      <PhoneShell background={resultScreen.background} roomCode={view.roomCode}>
        <div class="vb-giant-title">{resultScreen.title}</div>
        <div class="vb-score-list">
          {resultScreen.rows.map((row) => (
            <div class="vb-score-row" key={row.playerId}>
              <span class="vb-score-name">
                #{row.rank} {row.nameLabel}
                {row.roleLabel && <span class="vb-score-sub">{row.roleLabel}</span>}
              </span>
              <span>
                {row.points} <span class={`vb-delta ${row.deltaClass}`}>{row.deltaLabel}</span>
              </span>
            </div>
          ))}
        </div>
        <button class="vb-cta" type="button" onClick={() => setStoredResultMemory(dismissResult(resultMemory))}>
          Next round
        </button>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell
      background={roundControls.kind === 'judge-round' ? roundControls.background : bettingPanel.background}
      roomCode={view.roomCode}
    >
      {gameState?.round && roundControls.kind === 'judge-round' ? (
        <>
          <div class="vb-giant-title vb-title-small">Did {roundControls.activePlayerName} pull it off?</div>
          <div class="vb-giant-sub">Every bet is already locked in.</div>
          <div class="vb-tapzones">
            <button class="vb-tapzone success" type="button" onClick={() => onResolveRound('YES')}>
              ✅<br />Success
            </button>
            <button class="vb-tapzone fail" type="button" onClick={() => onResolveRound('NO')}>
              ❌<br />Fail
            </button>
          </div>
        </>
      ) : gameState?.round ? (
        <>
          {challengeCard?.kind === 'hidden' ? (
            <div class="vb-task-card vb-task-hidden">
              <div class="vb-task-label">Challenge</div>
              <div class="vb-task-text">{challengeCard.title}</div>
              <div class="vb-task-detail">{challengeCard.detail}</div>
            </div>
          ) : challengeCard?.kind === 'visible' ? (
            <div class="vb-task-card">
              <div class="vb-task-label">Challenge</div>
              <div class="vb-task-text">{challengeCard.text}</div>
              {challengeCard.illustration && <img class="vb-task-illustration" src={challengeCard.illustration} alt="" />}
            </div>
          ) : null}
          <div class="vb-status-pill">
            {bettingPanel.bettors.length === 0
              ? 'Waiting for bettors.'
              : bettingPanel.bettors.map((bettor) => `${bettor.hasBet ? '✓' : '○'} ${bettor.name}`).join(' · ')}
          </div>
          {bettingPanel.kind === 'form' ? (
            <div class="vb-bet-form">
              <div class="vb-tapzones">
                {(['YES', 'NO'] as const).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    class={`vb-tapzone ${choice === 'YES' ? 'yes' : 'no'}${prediction === choice ? ' chosen' : ''}`}
                    aria-pressed={prediction === choice}
                    onClick={() => setPrediction(choice)}
                  >
                    {choice}
                  </button>
                ))}
              </div>
              <div class="vb-amount-value">{amount} pts</div>
              <input
                class="vb-slider-white"
                type="range"
                min="1"
                max={bettingPanel.maxBet}
                value={amount}
                aria-label="Bet amount"
                onInput={(event) => setAmount(Number((event.target as HTMLInputElement).value))}
              />
              <div class="vb-giant-sub vb-slider-caption">
                Max {bettingPanel.maxBet} &middot; you have {bettingPanel.points} pts
              </div>
              <button class="vb-cta" type="button" disabled={prediction === null} onClick={handleLockIn}>
                Lock in bet
              </button>
            </div>
          ) : bettingPanel.kind === 'locked' ? (
            <>
              <div class="vb-giant-title vb-title-small">Locked in 🔒</div>
              {bettingPanel.ownBet && (
                <div class="vb-status-pill">
                  You bet {bettingPanel.ownBet.amount} pts on {bettingPanel.ownBet.prediction}
                </div>
              )}
              <div class="vb-giant-sub">{bettingPanel.waitingLabel}</div>
            </>
          ) : null}
        </>
      ) : (
        <div class="vb-giant-sub">Loading…</div>
      )}
    </PhoneShell>
  );
}
