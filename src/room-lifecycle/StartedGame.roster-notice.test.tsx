import { render, screen } from '@testing-library/preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { challengeBank } from '../challenge-bank/challenge-bank';
import { dictionaries } from '../i18n/dictionaries';
import { translate } from '../i18n/translate';
import type { GameState } from '../protocol/messages';
import { StartedGame } from './StartedGame';
import { ROSTER_NOTICE_DURATION_MS } from './roster-notice';
import type { Room } from './room';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const CODE = 'ABCDEF';
const room: Room = { code: CODE, hostName: 'Host', hostPlayerId: 'host-1', players: [], playerCount: 1, started: true };

const host = { playerId: 'host-1', name: 'Host', points: 100, status: 'active', connected: true } as const;
const alex = { playerId: 'guest-1', name: 'Alex', points: 100, status: 'active', connected: true } as const;
const sam = { playerId: 'guest-2', name: 'Sam', points: 100, status: 'active', connected: true } as const;

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

const leftText = (name: string) => translate(dictionaries.pl, 'notice.left', { name });
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('StartedGame roster notice timer', () => {
  it('hides the notice after its duration', () => {
    const { rerender } = render(startedGame(stateWith([host, alex, sam])));

    rerender(startedGame(stateWith([host, alex])));
    advance(ROSTER_NOTICE_DURATION_MS - 1);
    expect(screen.getByText(leftText('Sam'))).toBeTruthy();

    advance(1);
    expect(screen.queryByText(leftText('Sam'))).toBeNull();
  });

  it('restarts the timer when a newer notice replaces the shown one', () => {
    const { rerender } = render(startedGame(stateWith([host, alex, sam])));
    rerender(startedGame(stateWith([host, alex])));
    advance(ROSTER_NOTICE_DURATION_MS - 1_000);

    rerender(startedGame(stateWith([host])));
    advance(ROSTER_NOTICE_DURATION_MS - 1);
    expect(screen.getByText(leftText('Alex'))).toBeTruthy();

    advance(1);
    expect(screen.queryByText(leftText('Alex'))).toBeNull();
  });

  it('clears the timer on unmount', () => {
    const { rerender, unmount } = render(startedGame(stateWith([host, alex, sam])));
    rerender(startedGame(stateWith([host, alex])));
    const pending = vi.getTimerCount();
    expect(pending).toBeGreaterThan(0);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
