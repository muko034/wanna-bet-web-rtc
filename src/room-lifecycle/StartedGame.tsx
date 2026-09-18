import { route } from 'preact-router';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { PhoneShell } from '../PhoneShell';
import { NotFound } from '../NotFound';
import { withBase } from '../base-path';
import { challengeBank } from '../challenge-bank/challenge-bank';
import type { GameState, Prediction, PlaceBetPayload } from '../protocol/messages';
import { loadIdentity } from './player-identity';
import { resolveChallengeCard } from './challenge-card';
import { hasPlacedBet, resolveBettingPanel } from './betting-panel';
import { resolveResolutionSummary } from './resolution-summary';
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
  const [amount, setAmount] = useState('1');
  const [prediction, setPrediction] = useState<Prediction>('YES');
  const [submittedRoundKey, setSubmittedRoundKey] = useState<string | null>(null);

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
  const localBetSeenInBroadcast = !!localPlayerId && hasPlacedBet(gameState?.round ?? null, localPlayerId);

  useEffect(() => {
    setSubmittedRoundKey(null);
    setAmount('1');
    setPrediction('YES');
  }, [roundKey]);

  const bettingPanel = useMemo(
    () => (
      localPlayerId
        ? resolveBettingPanel({
          gameState,
          localPlayerId,
          locallySubmittedBet: submittedRoundKey === roundKey && !localBetSeenInBroadcast,
        })
        : { kind: 'hidden', bettors: [] as const }
    ),
    [gameState, localBetSeenInBroadcast, localPlayerId, roundKey, submittedRoundKey],
  );
  const challengeCard = localPlayerId
    ? resolveChallengeCard({ gameState, localPlayerId, challengeBank, displayLanguage: 'pl' })
    : null;
  const localBetPlaced = bettingPanel.bettors.some((bettor) => bettor.isLocalPlayer && bettor.hasBet);
  const roundControls = resolveRoundControls({ code, room, gameState });
  const resolutionSummary = resolveResolutionSummary(gameState);

  const handleBetSubmit = (event: JSX.TargetedEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!roundKey) {
      return;
    }
    onPlaceBet({ amount: Number(amount), prediction });
    setSubmittedRoundKey(roundKey);
  };

  return (
    <PhoneShell background="vb-bg-wait" roomCode={view.roomCode}>
      <div class="vb-giant-title" style="font-size:24px">
        {gameState?.round ? 'Round in progress' : resolutionSummary ? 'Round resolved' : 'Game started'}
      </div>
      {gameState?.round ? (
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
            <form onSubmit={handleBetSubmit} style="width:100%;display:flex;flex-direction:column;gap:12px">
              <input
                class="vb-input-white"
                type="number"
                min="1"
                inputMode="numeric"
                value={amount}
                onInput={(event) => setAmount((event.target as HTMLInputElement).value)}
                required
              />
              <div style="display:flex;gap:12px">
                <label>
                  <input
                    type="radio"
                    name="prediction"
                    value="YES"
                    checked={prediction === 'YES'}
                    onChange={() => setPrediction('YES')}
                  />
                  YES
                </label>
                <label>
                  <input
                    type="radio"
                    name="prediction"
                    value="NO"
                    checked={prediction === 'NO'}
                    onChange={() => setPrediction('NO')}
                  />
                  NO
                </label>
              </div>
              <button class="vb-cta" type="submit">Place bet</button>
            </form>
          ) : bettingPanel.kind === 'submitted' ? (
            <div class="vb-status-pill">Bet submitted.</div>
          ) : localBetPlaced ? (
            <div class="vb-status-pill">Bet placed.</div>
          ) : null}
          {roundControls.kind === 'resolve-round' ? (
            <div style="width:100%;display:flex;gap:12px">
              <button class="vb-cta" type="button" onClick={() => onResolveRound('YES')}>Outcome: YES</button>
              <button class="vb-cta" type="button" onClick={() => onResolveRound('NO')}>Outcome: NO</button>
            </div>
          ) : null}
        </>
      ) : resolutionSummary ? (
        <>
          <div class="vb-status-pill">
            {resolutionSummary.activePlayerName} {resolutionSummary.outcome === 'YES' ? 'succeeded' : 'failed'}
          </div>
          <div style="width:100%;display:flex;flex-direction:column;gap:8px">
            {resolutionSummary.pointChanges.map((pointChange) => (
              <div class="vb-status-pill" key={pointChange.playerId}>
                {pointChange.name}: {pointChange.change >= 0 ? '+' : ''}{pointChange.change} pts · {pointChange.points} total
              </div>
            ))}
          </div>
          {roundControls.kind === 'start-round' ? (
            <button class="vb-cta" type="button" onClick={onStartRound}>
              Start next round for {roundControls.activePlayerName}
            </button>
          ) : (
            <div class="vb-giant-sub">Waiting for the Host to start the next round.</div>
          )}
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
