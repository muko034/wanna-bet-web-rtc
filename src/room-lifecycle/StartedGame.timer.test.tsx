import { act, fireEvent, render, screen } from '@testing-library/preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { challengeBank } from '../challenge-bank/challenge-bank';
import { dictionaries, type MessageKey } from '../i18n/dictionaries';
import { LanguageProvider } from '../i18n/LanguageContext';
import { translate, type MessageParams } from '../i18n/translate';
import type { GameState } from '../protocol/messages';
import { StartedGame } from './StartedGame';
import type { Room } from './room';

const CODE = 'ABCDEF';
const room: Room = { code: CODE, hostName: 'Host', hostPlayerId: 'host-1', players: [], playerCount: 1, started: true };

const host = { playerId: 'host-1', name: 'Host', points: 100, status: 'active', connected: true } as const;
const anna = { playerId: 'guest-1', name: 'Anna', points: 100, status: 'active', connected: true } as const;

const [timedChallenge, otherTimedChallenge] = challengeBank.filter((entry) => entry.timeLimit === 'QUARTER_MINUTE');

const t = (key: MessageKey, params?: MessageParams) => translate(dictionaries.pl, key, params);
const startButton = () => screen.queryByRole('button', { name: t('challengeCard.startTimer', { limit: '15s' }) });
const ringButton = () => screen.queryByRole('button', { name: t('challengeCard.stopTimer') });

function stateWith(options: { challengerId?: string; challengeId?: string; bets?: string[]; round?: boolean } = {}): GameState {
  const { challengerId = 'guest-1', challengeId = timedChallenge.id, bets = [], round = true } = options;
  return {
    roomId: CODE,
    status: 'active',
    challengerId,
    resolution: null,
    round: round ? { challengerId, challengeId, bets: bets.map((playerId) => ({ playerId })), outcome: null } : null,
    players: [host, anna],
  };
}

function startedGame(gameState: GameState) {
  const noop = vi.fn();
  return (
    <LanguageProvider>
      <StartedGame
        code={CODE}
        room={room}
        guestGameStartedCode={null}
        gameState={gameState}
        joinRequests={[]}
        onAdmitJoin={noop}
        onDeclineJoin={noop}
        onPlaceBet={noop}
        betFailedRoundKey={null}
        onReconnectGaveUp={noop}
        onResolveRound={noop}
        onPauseGuest={noop}
        onResumeGuest={noop}
        onRemoveGuest={noop}
        onRemoved={noop}
        onRedraw={noop}
        onGameStarted={noop}
        onGameState={noop}
        onPlaceBetReady={noop}
        onBetRejected={noop}
        onConnectionLost={noop}
        onLeave={noop}
        onSitOut={noop}
        onHostLeave={noop}
        createGuestTransport={() => {
          throw new Error('Host view must not open a Guest transport');
        }}
        isSatOut={() => false}
      />
    </LanguageProvider>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.setItem('wanna-bet:language', 'pl');
});

function runningTimer(gameState: GameState) {
  const view = render(startedGame(gameState));
  fireEvent.click(startButton()!);
  act(() => { vi.advanceTimersByTime(3_000); });
  expect(ringButton()?.textContent).toBe('12');
  return view;
}

describe('Timer reset on the round screen', () => {
  it('keeps running while the same Round is re-rendered', () => {
    const { rerender } = runningTimer(stateWith());

    rerender(startedGame({ ...stateWith(), players: [{ ...host, points: 150 }, anna] }));

    expect(ringButton()?.textContent).toBe('12');
  });

  it('goes back to the icon on a Redraw', () => {
    const { rerender } = runningTimer(stateWith());

    rerender(startedGame(stateWith({ challengeId: otherTimedChallenge.id })));

    expect(startButton()).not.toBeNull();
    expect(ringButton()).toBeNull();
  });

  it('goes back to the icon when the Challenger changes', () => {
    const { rerender } = runningTimer(stateWith({ challengerId: 'guest-1' }));

    rerender(startedGame(stateWith({ challengerId: 'host-1' })));

    expect(startButton()).not.toBeNull();
    expect(ringButton()).toBeNull();
  });

  it('goes back to the icon when the Round ends', () => {
    const { rerender } = runningTimer(stateWith());

    rerender(startedGame(stateWith({ round: false })));
    rerender(startedGame(stateWith()));

    expect(startButton()).not.toBeNull();
    expect(ringButton()).toBeNull();
  });

  it('goes back to the icon on the Host judging screen', () => {
    const { rerender } = runningTimer(stateWith());

    rerender(startedGame(stateWith({ bets: ['host-1'] })));

    expect(startButton()).not.toBeNull();
    expect(ringButton()).toBeNull();
  });
});
