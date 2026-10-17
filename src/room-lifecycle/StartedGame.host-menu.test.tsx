import { fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { challengeBank } from '../challenge-bank/challenge-bank';
import { dictionaries, type MessageKey } from '../i18n/dictionaries';
import { translate } from '../i18n/translate';
import type { MessageParams } from '../i18n/translate';
import type { GameState } from '../protocol/messages';
import { StartedGame } from './StartedGame';
import { saveIdentity } from './player-identity';
import type { Room } from './room';

const CODE = 'ABCDEF';
const room: Room = { code: CODE, hostName: 'Host', hostPlayerId: 'host-1', players: [], playerCount: 1, started: true };

type TestPlayer = GameState['players'][number];
const host: TestPlayer = { playerId: 'host-1', name: 'Host', points: 100, status: 'active', connected: true };
const alex: TestPlayer = { playerId: 'guest-1', name: 'Alex', points: 100, status: 'active', connected: true };
const sam: TestPlayer = { playerId: 'guest-2', name: 'Sam', points: 100, status: 'active', connected: true };
const hostPaused = (player: TestPlayer): TestPlayer => ({ ...player, status: 'paused', pausedBy: 'host' });
const satOut = (player: TestPlayer): TestPlayer => ({ ...player, status: 'paused', pausedBy: 'self' });

function stateWith(players: TestPlayer[]): GameState {
  return {
    roomId: CODE,
    status: 'active',
    challengerId: 'host-1',
    resolution: null,
    round: { challengerId: 'host-1', challengeId: challengeBank[0].id, bets: [], outcome: null },
    players,
  };
}

const t = (key: MessageKey, params?: MessageParams) => translate(dictionaries.pl, key, params);

function renderAs(role: 'host' | 'guest', gameState: GameState) {
  const props = {
    onPauseGuest: vi.fn(),
    onResumeGuest: vi.fn(),
  };
  const noop = vi.fn();
  if (role === 'guest') {
    saveIdentity(localStorage, CODE, { playerId: alex.playerId, reconnectToken: 'token' });
  }
  render(
    <StartedGame
      code={CODE}
      room={role === 'host' ? room : null}
      guestGameStartedCode={role === 'guest' ? CODE : null}
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
        throw new Error('must not open a Guest transport');
      }}
      isSatOut={() => false}
      {...props}
    />,
  );
  fireEvent.click(document.querySelector('.vb-rank-badge')!);
  return props;
}

const menuButton = (name: string) => screen.queryByRole('button', { name: t('hostMenu.open', { name }) });
const menuButtons = () => document.querySelectorAll('[aria-haspopup="menu"]');
const menuItem = (key: MessageKey) => screen.queryByRole('menuitem', { name: t(key) });

afterEach(() => vi.restoreAllMocks());

describe('Leaderboard row menu', () => {
  it('shows the Host a menu on each Guest row, but not on their own row', () => {
    renderAs('host', stateWith([host, alex, sam]));

    expect(menuButton('Alex')).not.toBeNull();
    expect(menuButton('Sam')).not.toBeNull();
    expect(menuButton('Host')).toBeNull();
    expect(menuButtons()).toHaveLength(2);
  });

  it('shows a Guest no menu on any row', () => {
    renderAs('guest', stateWith([host, alex, sam]));

    expect(menuButtons()).toHaveLength(0);
  });

  it('offers Pause alone for an active Guest, and pauses them in one tap', () => {
    const { onPauseGuest } = renderAs('host', stateWith([host, alex, sam]));

    fireEvent.click(menuButton('Sam')!);
    expect(menuItem('hostMenu.resume')).toBeNull();
    fireEvent.click(menuItem('hostMenu.pause')!);

    expect(onPauseGuest).toHaveBeenCalledWith('guest-2');
    expect(menuItem('hostMenu.pause')).toBeNull();
  });

  it('offers Resume alone for a Host-paused Guest, and resumes them in one tap', () => {
    const { onResumeGuest } = renderAs('host', stateWith([host, alex, hostPaused(sam)]));

    fireEvent.click(menuButton('Sam')!);
    expect(menuItem('hostMenu.pause')).toBeNull();
    fireEvent.click(menuItem('hostMenu.resume')!);

    expect(onResumeGuest).toHaveBeenCalledWith('guest-2');
  });

  it('shows a stepped away label and no menu for a Guest in Sit Out', () => {
    renderAs('host', stateWith([host, alex, satOut(sam)]));

    expect(menuButton('Sam')).toBeNull();
    expect(screen.getByText(t('leaderboard.steppedAway'))).toBeTruthy();
  });

  it.each([
    ['opens downward when it fits', 100, 'down'],
    ['opens upward when it would clip at the bottom', 590, 'up'],
  ] as const)('%s', (_name, triggerBottom, placement) => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('vb-rank-sheet')) return { top: 0, bottom: 600 } as DOMRect;
      return { top: triggerBottom - 24, bottom: triggerBottom } as DOMRect;
    });
    renderAs('host', stateWith([host, alex, sam]));

    fireEvent.click(menuButton('Sam')!);

    expect(screen.getByRole('menu').classList.contains(placement)).toBe(true);
  });
});
