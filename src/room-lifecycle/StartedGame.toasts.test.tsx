import { render, screen } from '@testing-library/preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { challengeBank } from '../challenge-bank/challenge-bank';
import { dictionaries } from '../i18n/dictionaries';
import { translate } from '../i18n/translate';
import type { GameState } from '../protocol/messages';
import { StartedGame } from './StartedGame';
import { TOAST_DURATION_MS } from './use-toasts';
import type { Room } from './room';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const CODE = 'ABCDEF';
const room: Room = { code: CODE, hostName: 'Host', hostPlayerId: 'host-1', players: [], playerCount: 1, started: true };

const host = { playerId: 'host-1', name: 'Host', points: 100, status: 'active', connected: true } as const;
const alex = { playerId: 'guest-1', name: 'Alex', points: 100, status: 'active', connected: true } as const;
const sam = { playerId: 'guest-2', name: 'Sam', points: 100, status: 'active', connected: true } as const;

function left(player: GameState['players'][number]): GameState['players'][number] {
  return { ...player, status: 'removed' };
}

function stateWith(players: GameState['players']): GameState {
  return {
    roomId: CODE,
    status: 'active',
    challengerId: 'guest-1',
    resolution: null,
    round: { challengerId: 'guest-1', challengeId: challengeBank[0].id, bets: [], outcome: null },
    players,
  };
}

const noop = vi.fn();
function startedGame(gameState: GameState) {
  return (
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
  );
}

const leftText = (name: string) => translate(dictionaries.pl, 'notice.left', { name });
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('StartedGame Host Admin notices', () => {
  it('names a player the Host paused, then resumed, in the Display Language', () => {
    const paused = { ...sam, status: 'paused', pausedBy: 'host' } as const;
    const { rerender } = render(startedGame(stateWith([host, alex, sam])));

    rerender(startedGame(stateWith([host, alex, paused])));
    expect(screen.getByText(translate(dictionaries.pl, 'notice.hostPaused', { name: 'Sam' }))).toBeTruthy();

    rerender(startedGame(stateWith([host, alex, sam])));
    expect(screen.getByText(translate(dictionaries.pl, 'notice.hostResumed', { name: 'Sam' }))).toBeTruthy();
  });
});

describe('StartedGame join notice', () => {
  it('names the Late Joiner and their starting Points in the Display Language', () => {
    const { rerender } = render(startedGame(stateWith([host, alex])));

    rerender(startedGame(stateWith([host, alex, { ...sam, points: 40 }])));

    expect(screen.getByText(translate(dictionaries.pl, 'notice.joined', { name: 'Sam', points: 40 }))).toBeTruthy();
  });

  it('has an English copy naming the player and the Points', () => {
    const text = translate(dictionaries.en, 'notice.joined', { name: 'Sam', points: 40 });

    expect(text).toContain('Sam');
    expect(text).toContain('40');
  });
});

function redrawn(state: GameState, challengeId: string): GameState {
  return { ...state, round: { ...state.round!, challengeId } };
}

const changedText = translate(dictionaries.pl, 'challengeNotice.changed');
const betAgainText = translate(dictionaries.pl, 'challengeNotice.betAgain');

describe('StartedGame toasts', () => {
  it('shows a roster notice as a status toast outside the content flow', () => {
    const { rerender } = render(startedGame(stateWith([host, alex, sam])));

    rerender(startedGame(stateWith([host, alex, left(sam)])));

    const toast = screen.getByRole('status');
    expect(toast.textContent).toBe(leftText('Sam'));
    expect(toast.closest('.vb-stage')).toBeNull();
  });

  it('hides the toast after its duration', () => {
    const { rerender } = render(startedGame(stateWith([host, alex, sam])));

    rerender(startedGame(stateWith([host, alex, left(sam)])));
    advance(TOAST_DURATION_MS - 1);
    expect(screen.getByText(leftText('Sam'))).toBeTruthy();

    advance(1);
    expect(screen.queryByText(leftText('Sam'))).toBeNull();
  });

  it('stacks two notices that arrive together as separate toasts', () => {
    const { rerender } = render(startedGame(stateWith([host, alex, sam])));

    rerender(startedGame(stateWith([host, left(alex), left(sam)])));

    expect(screen.getAllByRole('status').map((toast) => toast.textContent)).toEqual([leftText('Alex'), leftText('Sam')]);
  });

  it('does not cut an older toast short when a newer one arrives', () => {
    const { rerender } = render(startedGame(stateWith([host, alex, sam])));
    rerender(startedGame(stateWith([host, alex, left(sam)])));
    advance(TOAST_DURATION_MS - 1_000);

    rerender(startedGame(stateWith([host, left(alex), left(sam)])));
    expect(screen.getByText(leftText('Sam'))).toBeTruthy();
    expect(screen.getByText(leftText('Alex'))).toBeTruthy();

    advance(1_000);
    expect(screen.queryByText(leftText('Sam'))).toBeNull();
    expect(screen.getByText(leftText('Alex'))).toBeTruthy();

    advance(TOAST_DURATION_MS - 1_000);
    expect(screen.queryByText(leftText('Alex'))).toBeNull();
  });

  it('shows no toast for the local player\'s own action or without a previous snapshot', () => {
    const { rerender } = render(startedGame(stateWith([host, alex, sam])));
    rerender(startedGame(stateWith([left(host), alex, sam])));
    expect(screen.queryByRole('status')).toBeNull();

    const fresh = render(startedGame(stateWith([host, alex, left(sam)])));
    expect(fresh.queryByRole('status')).toBeNull();
  });

  it('announces a Redraw as a status toast that ends after its duration while the card still shakes and the Bet form pops in', () => {
    const first = stateWith([host, alex, sam]);
    const { rerender, container } = render(startedGame(first));

    rerender(startedGame(redrawn(first, challengeBank[1].id)));

    const toast = screen.getByRole('status');
    expect(toast.textContent).toContain(changedText);
    expect(toast.textContent).toContain(betAgainText);
    expect(toast.closest('.vb-stage')).toBeNull();

    advance(TOAST_DURATION_MS);
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.querySelector('.vb-task-card')?.classList.contains('vb-shake')).toBe(true);
    expect(container.querySelector('.vb-bet-form')?.classList.contains('vb-pop-in')).toBe(true);
  });
});

describe('StartedGame toast cleanup', () => {
  it('clears the timers on unmount', () => {
    const { rerender, unmount } = render(startedGame(stateWith([host, alex, sam])));
    rerender(startedGame(stateWith([host, alex, left(sam)])));
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
