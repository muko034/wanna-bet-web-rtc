import { fireEvent, render, screen } from '@testing-library/preact';
import { route } from 'preact-router';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withBase } from '../base-path';
import { challengeBank } from '../challenge-bank/challenge-bank';
import { dictionaries } from '../i18n/dictionaries';
import { translate } from '../i18n/translate';
import type { GameState } from '../protocol/messages';
import { StartedGame } from './StartedGame';
import { RESULT_SCREEN_DURATION_MS } from './result-screen';
import type { Room } from './room';

vi.mock('preact-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('preact-router')>()),
  route: vi.fn(),
}));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.mocked(route).mockClear();
});

const CODE = 'ABCDEF';
const startedRoom: Room = { code: CODE, hostName: 'Host', hostPlayerId: 'host-1', players: [], playerCount: 1, started: true };
const lobbyRoom: Room = { ...startedRoom, started: false };

const host = { playerId: 'host-1', name: 'Host', points: 100, status: 'active', connected: true } as const;
const alex = { playerId: 'guest-1', name: 'Alex', points: 100, status: 'active', connected: true } as const;

function stateWith(challengeIndex: number, resolution: GameState['resolution'] = null): GameState {
  return {
    roomId: CODE,
    status: 'active',
    challengerId: 'guest-1',
    resolution,
    round: { challengerId: 'guest-1', challengeId: challengeBank[challengeIndex].id, bets: [], outcome: null },
    players: [host, alex],
  };
}

const noop = vi.fn();
function startedGame(room: Room, gameState: GameState) {
  return (
    <StartedGame
      code={CODE}
      room={room}
      guestGameStartedCode={null}
      gameState={gameState}
      onPlaceBet={noop}
      betFailedRoundKey={null}
      onReconnectGaveUp={noop}
      onResolveRound={noop}
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
  );
}

const text = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => translate(dictionaries.pl, key, params);
const yesButton = () => screen.getByRole('button', { name: text('betting.yes') });
const lockInButton = () => screen.getByRole('button', { name: text('betting.lockIn') }) as HTMLButtonElement;
const slider = () => screen.getByLabelText('Bet amount') as HTMLInputElement;

describe('StartedGame redirect effect', () => {
  it('routes to the Lobby once', () => {
    const { rerender } = render(startedGame(lobbyRoom, stateWith(0)));
    rerender(startedGame(lobbyRoom, stateWith(0)));

    expect(route).toHaveBeenCalledOnce();
    expect(route).toHaveBeenCalledWith(withBase(`room/${CODE}`), true);
  });

  it('does not route while the Room has started', () => {
    render(startedGame(startedRoom, stateWith(0)));

    expect(route).not.toHaveBeenCalled();
  });
});

describe('StartedGame new Round reset', () => {
  it('resets the Bet amount, Prediction and submitted Bet', () => {
    const { rerender } = render(startedGame(startedRoom, stateWith(0)));
    fireEvent.click(yesButton());
    fireEvent.input(slider(), { target: { value: '5' } });
    fireEvent.click(lockInButton());
    expect(screen.getByText(text('betting.lockedIn'))).toBeTruthy();

    rerender(startedGame(startedRoom, stateWith(1)));

    expect(screen.queryByText(text('betting.lockedIn'))).toBeNull();
    expect(yesButton().getAttribute('aria-pressed')).toBe('false');
    expect(slider().value).toBe('1');
    expect(lockInButton().disabled).toBe(true);
  });
});

describe('StartedGame leaderboard effect', () => {
  const badge = () => screen.getByRole('button', { name: /#\d/ });
  const sheet = () => screen.queryByRole('dialog', { name: 'Leaderboard' });

  it('closes the Leaderboard when a Result Screen shows', () => {
    const { rerender } = render(startedGame(startedRoom, stateWith(0)));
    fireEvent.click(badge());
    expect(sheet()).not.toBeNull();

    rerender(startedGame(startedRoom, stateWith(1, { challengerId: 'guest-1', outcome: 'YES', payouts: [] })));
    expect(screen.getByText(text('result.nextRound'))).toBeTruthy();
    act(() => { vi.advanceTimersByTime(RESULT_SCREEN_DURATION_MS); });

    expect(screen.queryByText(text('result.nextRound'))).toBeNull();
    expect(sheet()).toBeNull();
  });
});
