import { route } from 'preact-router';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { PhoneShell } from '../PhoneShell';
import { NotFound } from '../NotFound';
import { withBase } from '../base-path';
import { challengeBank } from '../challenge-bank/challenge-bank';
import type { GameState, Prediction, PlaceBetPayload } from '../protocol/messages';
import { loadIdentity } from './player-identity';
import { resolveChallengeCard } from './challenge-card';
import { resolveBettingPanel } from './betting-panel';
import { dismissResult, initialResultMemory, observeResolution, resolveResultScreen } from './result-screen';
import { resolveRoundControls } from './round-controls';
import { resolveStartedGameView } from './started-game-view';
import type { Room } from './room';

type Props = {
  path?: string;
  code?: string;
  room: Room | null;
  /** The Room Code for which this Guest has locally observed the Host's game-started broadcast — see `resolveStartedGameView`. */
  guestGameStartedCode: string | null;
  gameState: GameState | null;
  onPlaceBet: (payload: PlaceBetPayload) => void;
  onResolveRound: (outcome: Prediction) => void;
  onStartRound: () => void;
};

/**
 * `/room/<CODE>/play`: the started-game view. Redirects the Host back to the Lobby if the
 * Host's own Room hasn't started; a Guest reaches this view via its own
 * `guestGameStartedCode` signal instead, since a Guest never holds a local `Room` object
 * (see `resolveStartedGameView`). While a round is open, it shows the Challenge card plus
 * per-Bettor public bet status, and it lets an eligible local Bettor submit a Bet.
 */
export function StartedGame({
  code,
  room,
  guestGameStartedCode,
  gameState,
  onPlaceBet,
  onResolveRound,
  onStartRound,
}: Props) {
  const view = resolveStartedGameView({ code, room, guestGameStartedCode });
  const [amount, setAmount] = useState(1);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [submittedBet, setSubmittedBet] = useState<{ roundKey: string; bet: PlaceBetPayload } | null>(null);
  const [storedResultMemory, setStoredResultMemory] = useState(initialResultMemory);
  // Pure and idempotent, so deriving it during render shows a new Resolution on the very frame it arrives.
  const resultMemory = observeResolution(storedResultMemory, gameState);

  useEffect(() => {
    if (resultMemory !== storedResultMemory) {
      setStoredResultMemory(resultMemory);
    }
  }, [resultMemory, storedResultMemory]);

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
      <div class="vb-giant-title vb-title-small">
        {gameState?.round ? 'Round in progress' : 'Game started'}
      </div>
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
      ) : roundControls.kind === 'start-round' ? (
        <button class="vb-cta" type="button" onClick={onStartRound}>
          Start round for {roundControls.activePlayerName}
        </button>
      ) : (
        <div class="vb-giant-sub">Starting the round…</div>
      )}
    </PhoneShell>
  );
}
