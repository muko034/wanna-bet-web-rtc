import { route } from 'preact-router';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { PhoneShell } from '../PhoneShell';
import { NotFound } from '../NotFound';
import { withBase } from '../base-path';
import { challengeBank } from '../challenge-bank/challenge-bank';
import type { PeerJsTransport } from '../transport/peerjs-transport';
import type { GameState, Prediction, PlaceBetPayload } from '../protocol/messages';
import { loadIdentity } from './player-identity';
import { attemptReconnect, type ReconnectCallbacks } from './guest-reconnect';
import { resolveChallengeCard } from './challenge-card';
import { ChallengeCardTitle } from './ChallengeCardTitle';
import { isChallengeRedrawn } from './challenge-change';
import { nextChallengeNotice, resolveChallengeChrome, type ChallengeNotice } from './challenge-notice';
import { resolveLockIn } from './lock-in';
import { roundKeyOf, type PlaceBetContext } from './bet-delivery';
import type { BetRejection } from '../round-engine/round-engine';
import { resolveGameResult } from './game-result';
import { resolveLeaderboard } from './leaderboard';
import { LeaderboardBadge, LeaderboardSheet } from './LeaderboardSheet';
import { resolveBettingPanel } from './betting-panel';
import { deriveResultMemory, dismissResult, resolveResultScreen, type ResultMemory } from './result-screen';
import { JoinRoom } from './JoinRoom';
import { ReconnectingScreen } from './ReconnectingScreen';
import { HomeDialog } from './HomeDialog';
import { resolveHomeChoice, resolveHomeDialog, type HomeDialogAction } from './home-dialog';
import { isHostRoom } from './room-role';
import { resolveRoundControls } from './round-controls';
import { resolveStartedGameView, type ReconnectPhase } from './started-game-view';
import { useForegroundRetry } from './use-foreground-retry';
import { useResultScreenExpiry } from './use-result-screen-expiry';
import { useLinkLostDuration } from './use-link-lost-duration';
import { roomRegistry } from './room-registry-instance';
import type { Room } from './room';

const RECONNECT_ERROR_MESSAGES: Record<'unreachable', string> = {
  unreachable: "Couldn't reach the Host — check the link and try again.",
};

type Props = {
  path?: string;
  code?: string;
  room: Room | null;
  /** The Room Code for which this Guest has locally observed the Host's game-started broadcast — see `resolveStartedGameView`. */
  guestGameStartedCode: string | null;
  gameState: GameState | null;
  /** `context` identifies the Round and local player, so a Guest's Bet can be confirmed against later `state` broadcasts. */
  onPlaceBet: (payload: PlaceBetPayload, context: PlaceBetContext) => void;
  /** Round key of a Bet that never reached the Host — the Bettor may lock in again. */
  betFailedRoundKey: string | null;
  /** The reconnect fallback ("Can't reach the Host") triggered, so any pending Bet has failed. */
  onReconnectGaveUp: () => void;
  onResolveRound: (outcome: Prediction) => void;
  /** Host only: replaces the current Challenge with a new draw. */
  onRedraw: () => void;
  /** Notifies the caller that this Guest observed the Host's game-started broadcast for `code`. */
  onGameStarted: (code: string) => void;
  onGameState: (state: GameState) => void;
  onPlaceBetReady: (placeBet: ((payload: PlaceBetPayload) => void) | null) => void;
  onBetRejected: (reason: BetRejection) => void;
  /**
   * This Guest's live connection was lost. Notifies App-level state (see `app.tsx`) so a
   * drop is recovered from the same way regardless of which route happened to establish the
   * connection that dropped — this route's own reconnect effect only runs when it's the one
   * currently unresolved, but a live connection can just as easily have been made by the
   * Lobby's join screen before the game started.
   */
  onConnectionLost: () => void;
  /** Guest only: Leave the Room for good and go Home. */
  onLeave: (code: string) => void;
  onSitOut: (code: string) => void;
  /** Host only: Leave ends the Room for everyone. */
  onHostLeave: () => void;
  /** Opens a fresh Guest transport, closing whichever one the App handed out before, whichever route established it. */
  createGuestTransport: () => PeerJsTransport;
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
  betFailedRoundKey,
  onReconnectGaveUp,
  onResolveRound,
  onRedraw,
  onGameStarted,
  onGameState,
  onPlaceBetReady,
  onBetRejected,
  onConnectionLost,
  onLeave,
  onSitOut,
  onHostLeave,
  createGuestTransport,
}: Props) {
  const [homeDialogOpen, setHomeDialogOpen] = useState(false);
  const [reconnectPhase, setReconnectPhase] = useState<ReconnectPhase>(null);
  const hasStoredIdentity = code !== undefined && loadIdentity(localStorage, code) !== null;
  const isGuestUnresolved = !isHostRoom(code, room) && guestGameStartedCode !== code;
  // Bumped by the "can't reach the Host" state's Retry button, to re-run the reconnect
  // effect below from scratch (including its own automatic retry budget) rather than a
  // single bare attempt.
  const [retryKey, setRetryKey] = useState(0);

  // Read through a ref so the reconnect effect below depends on `code` alone: a caller
  // passing a fresh callback per render must not re-run it, since each run opens a new Peer.
  const callbacksRef = useRef({ onGameStarted, onGameState, onPlaceBetReady, onBetRejected, onReconnectGaveUp, onConnectionLost });
  callbacksRef.current = { onGameStarted, onGameState, onPlaceBetReady, onBetRejected, onReconnectGaveUp, onConnectionLost };

  // Foregrounding mid-attempt restarts the reconnect effect, skipping the current backoff.
  useForegroundRetry(reconnectPhase === 'pending', () => setRetryKey((key) => key + 1));

  useEffect(() => {
    if (!code || !isGuestUnresolved || !hasStoredIdentity) return;

    setReconnectPhase('pending');
    const transport = createGuestTransport();
    let pending = true;
    const callbacks: ReconnectCallbacks = {
      onGameState: (state) => callbacksRef.current.onGameState(state),
      onGameStarted: (startedCode) => callbacksRef.current.onGameStarted(startedCode),
      // A drop is never a dead end: hand it to App-level state, which resets
      // `guestGameStartedCode` so this route's own `isGuestUnresolved` (below) becomes true
      // again and this same effect re-enters to reconnect — even if the connection that just
      // dropped was actually established elsewhere (e.g. the Lobby's join screen, before the
      // game started).
      onConnectionDropped: () => {
        callbacksRef.current.onPlaceBetReady(null);
        callbacksRef.current.onConnectionLost();
      },
      onPlaceBetReady: (placeBet) => callbacksRef.current.onPlaceBetReady(placeBet),
      onBetRejected: (reason) => callbacksRef.current.onBetRejected(reason),
    };
    attemptReconnect(transport, roomRegistry, localStorage, code, callbacks).then((result) => {
      if (!pending) return;
      pending = false;
      if (result.status === 'joined' || result.status === 'no-identity') {
        setReconnectPhase(null);
      } else if (result.status === 'unknown-player') {
        setReconnectPhase('unknown-player');
      } else {
        callbacksRef.current.onReconnectGaveUp();
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
  }, [code, isGuestUnresolved, hasStoredIdentity, retryKey]);

  const view = resolveStartedGameView({ code, room, guestGameStartedCode, hasStoredIdentity, reconnectPhase, hasGameState: gameState !== null, gameState });
  const linkLostForMs = useLinkLostDuration(view.view === 'started' && isGuestUnresolved);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
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

  useResultScreenExpiry(resultMemory, setStoredResultMemory);

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
        onBetRejected={onBetRejected}
        onConnectionLost={onConnectionLost}
        createGuestTransport={createGuestTransport}
      />
    );
  }

  if (view.view === 'reconnecting') {
    return <ReconnectingScreen roomCode={view.roomCode} />;
  }

  if (view.view === 'reconnect-failed') {
    return (
      <PhoneShell background="vb-bg-wait" roomCode={view.roomCode}>
        <div class="vb-giant-title" style="font-size:24px">
          Can't reach the Host
        </div>
        <div class="vb-giant-sub">{view.message}</div>
        <button class="vb-cta" type="button" onClick={() => setRetryKey((key) => key + 1)}>
          Retry
        </button>
      </PhoneShell>
    );
  }

  const localPlayerId = room?.code === code
    ? room?.hostPlayerId
    : (code ? loadIdentity(localStorage, code)?.playerId : null);
  const roundKey = gameState ? roundKeyOf(gameState) : null;
  const localBet = submittedBet?.roundKey === roundKey ? submittedBet.bet : null;

  useEffect(() => {
    setSubmittedBet(null);
    setAmount(1);
    setPrediction(null);
  }, [roundKey]);

  // A Redraw is a changed Challenge id within the same Round; the notice belongs to the Round key
  // it announced, so it never replays once the screen moves on.
  const previousGameStateRef = useRef<GameState | null>(null);
  const [challengeNotice, setChallengeNotice] = useState<ChallengeNotice | null>(null);
  useEffect(() => {
    const redrawn = isChallengeRedrawn(previousGameStateRef.current, gameState);
    previousGameStateRef.current = gameState;
    setChallengeNotice((notice) => nextChallengeNotice(notice, { redrawn, gameState }));
  }, [gameState]);
  const chrome = resolveChallengeChrome({ code, room, gameState, notice: challengeNotice });
  const redrawButton = chrome.showRedraw && (
    <button class="vb-home-fab vb-redraw" type="button" aria-label="Redraw Challenge" onClick={onRedraw}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
        <path d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z" />
      </svg>
    </button>
  );

  const bettingPanel = useMemo(
    () => resolveBettingPanel({ gameState, localPlayerId: localPlayerId ?? null, localBet, betFailed: betFailedRoundKey === roundKey, linkLostForMs }),
    [gameState, localBet, localPlayerId, betFailedRoundKey, roundKey, linkLostForMs],
  );
  const challengeCard = localPlayerId
    ? resolveChallengeCard({ gameState, localPlayerId, challengeBank, displayLanguage: 'pl' })
    : null;
  const roundControls = resolveRoundControls({ code, room, gameState });
  const resultScreen = resolveResultScreen({ memory: resultMemory, localPlayerId: localPlayerId ?? null });

  const homeDialog = resolveHomeDialog({ code, room });
  const chooseHomeOption = (action: HomeDialogAction) => {
    setHomeDialogOpen(false);
    const effect = resolveHomeChoice(action, code, room);
    if (effect.kind === 'host-leave') {
      onHostLeave();
    } else if (effect.kind === 'leave') {
      onLeave(effect.code);
    } else if (effect.kind === 'sit-out') {
      onSitOut(effect.code);
    } else if (effect.kind === 'go-home') {
      route(withBase('/'));
    }
  };
  const dialogOverlay = homeDialogOpen && <HomeDialog dialog={homeDialog} onChoose={chooseHomeOption} />;

  const leaderboard = resolveLeaderboard({ players: gameState?.players ?? null, localPlayerId: localPlayerId ?? null });

  const resultShown = resultScreen !== null;
  useEffect(() => {
    if (resultShown) {
      setLeaderboardOpen(false);
    }
  }, [resultShown]);

  const handleLockIn = () => {
    const lockIn = resolveLockIn({ gameState, localPlayerId, prediction, amount });
    if (!lockIn) {
      return;
    }
    onPlaceBet(lockIn.bet, { roundKey: lockIn.roundKey, playerId: lockIn.playerId });
    setSubmittedBet({ roundKey: lockIn.roundKey, bet: lockIn.bet });
  };

  const gameResult = resolveGameResult({ gameState, localPlayerId: localPlayerId ?? null });
  if (view.view === 'game-result' && gameResult) {
    return (
      <PhoneShell background={gameResult.background} roomCode={view.roomCode}>
        <div class="vb-giant-title">{gameResult.title}</div>
        <div class="vb-score-list">
          {gameResult.rows.map((row) => (
            <div class="vb-score-row" key={row.playerId}>
              <span class="vb-score-name">
                #{row.rank} {row.nameLabel}
                {row.isWinner && <span class="vb-score-sub">Winner 🏆</span>}
              </span>
              <span>{row.points}</span>
            </div>
          ))}
        </div>
        <a class="vb-cta" href={withBase('/')}>
          Home
        </a>
      </PhoneShell>
    );
  }

  if (resultScreen) {
    return (
      <PhoneShell background={resultScreen.background} roomCode={view.roomCode} onHome={() => setHomeDialogOpen(true)} overlay={dialogOverlay}>
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
      onHome={() => setHomeDialogOpen(true)}
      topRight={leaderboard.badge && <LeaderboardBadge badge={leaderboard.badge} onOpen={() => setLeaderboardOpen(true)} />}
      overlay={
        <>
          {leaderboardOpen && <LeaderboardSheet rows={leaderboard.rows} onClose={() => setLeaderboardOpen(false)} />}
          {dialogOverlay}
        </>
      }
    >
      {gameState?.round && roundControls.kind === 'judge-round' ? (
        <>
          <div class="vb-giant-title vb-title-small">Did {roundControls.challengerName} pull it off?</div>
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
          {chrome.noticeCount !== null && (
            <div class="vb-change-banner" role="status" key={`banner-${chrome.noticeCount}`}>
              Challenge changed
              <span class="vb-change-hint">Bet again</span>
            </div>
          )}
          {challengeCard?.kind === 'hidden' ? (
            <div class={`${chrome.cardClass} vb-task-hidden`} key={`card-${chrome.noticeCount ?? 0}`}>
              {redrawButton}
              <ChallengeCardTitle card={challengeCard} />
              <div class="vb-task-text">{challengeCard.title}</div>
              <div class="vb-task-detail">{challengeCard.detail}</div>
            </div>
          ) : challengeCard?.kind === 'visible' ? (
            <div class={chrome.cardClass} key={`card-${chrome.noticeCount ?? 0}`}>
              {redrawButton}
              <ChallengeCardTitle card={challengeCard} />
              <div class="vb-task-text">{challengeCard.text}</div>
              {challengeCard.illustration && <img class="vb-task-illustration" src={challengeCard.illustration} alt="" />}
            </div>
          ) : null}
          {bettingPanel.bettors.length === 0 ? (
            <div class="vb-status-pill">Waiting for bettors.</div>
          ) : (
            <div class="vb-bettor-pills">
              {bettingPanel.bettors.map((bettor) => (
                <div key={bettor.playerId} class={`vb-status-pill${bettor.hasBet ? ' placed' : ''}`}>
                  {bettor.name}
                </div>
              ))}
            </div>
          )}
          {bettingPanel.kind === 'form' ? (
            <div class={chrome.betFormClass}>
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
              {bettingPanel.failureMessage && <div class="vb-giant-sub" role="alert">{bettingPanel.failureMessage}</div>}
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
              {bettingPanel.reconnectingNotice && <div class="vb-giant-sub" role="status">{bettingPanel.reconnectingNotice}</div>}
            </>
          ) : null}
        </>
      ) : (
        <div class="vb-giant-sub">Loading…</div>
      )}
    </PhoneShell>
  );
}
