import { route } from 'preact-router';
import { useEffect } from 'preact/hooks';
import { PhoneShell } from '../PhoneShell';
import { NotFound } from '../NotFound';
import { withBase } from '../base-path';
import { challengeBank } from '../challenge-bank/challenge-bank';
import type { GameState } from '../protocol/messages';
import { loadIdentity } from './player-identity';
import { resolveChallengeCard } from './challenge-card';
import { resolveStartedGameView } from './started-game-view';
import type { Room } from './room';

type Props = {
  path?: string;
  code?: string;
  room: Room | null;
  /** The Room Code for which this Guest has locally observed the Host's game-started broadcast — see `resolveStartedGameView`. */
  guestGameStartedCode: string | null;
  gameState: GameState | null;
};

/**
 * `/room/<CODE>/play`: neutral placeholder for the started game, with no gameplay logic
 * yet. Redirects the Host back to the Lobby if the Host's own Room hasn't started; a Guest
 * reaches this view via its own `guestGameStartedCode` signal instead, since a Guest never
 * holds a local `Room` object (see `resolveStartedGameView`). The Host starts the first
 * Round automatically alongside the game itself — there's no separate Round-start control.
 */
export function StartedGame({ code, room, guestGameStartedCode, gameState }: Props) {
  const view = resolveStartedGameView({ code, room, guestGameStartedCode });

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
  const challengeCard = localPlayerId
    ? resolveChallengeCard({ gameState, localPlayerId, challengeBank, displayLanguage: 'pl' })
    : null;

  return (
    <PhoneShell background="vb-bg-wait" roomCode={view.roomCode}>
      <div class="vb-giant-title" style="font-size:24px">
        {gameState?.round ? 'Round in progress' : 'Game started'}
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
          <div class="vb-status-pill">Waiting for bets and outcome controls in the next tasks.</div>
        </>
      ) : (
        <div class="vb-giant-sub">Starting the round…</div>
      )}
    </PhoneShell>
  );
}
