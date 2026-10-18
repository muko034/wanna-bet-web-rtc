import { fireEvent, render, screen, within } from '@testing-library/preact';
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

function renderAs(role: 'host' | 'guest', gameState: GameState, joinRequests: string[] = []) {
  const props = {
    onAdmitJoin: vi.fn(),
    onDeclineJoin: vi.fn(),
    onPauseGuest: vi.fn(),
    onResumeGuest: vi.fn(),
    onRemoveGuest: vi.fn(),
    onRemoved: vi.fn(),
    onLeave: vi.fn(),
    onSitOut: vi.fn(),
  };
  const noop = vi.fn();
  if (role === 'guest') {
    saveIdentity(localStorage, CODE, { playerId: alex.playerId, reconnectToken: 'token' });
  }
  const screen = (state: GameState, requests: string[] = joinRequests) => (
    <StartedGame
      code={CODE}
      room={role === 'host' ? room : null}
      guestGameStartedCode={role === 'guest' ? CODE : null}
      gameState={state}
      joinRequests={requests}
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
      onHostLeave={noop}
      createGuestTransport={() => {
        throw new Error('must not open a Guest transport');
      }}
      isSatOut={() => false}
      {...props}
    />
  );
  const { rerender } = render(screen(gameState));
  const openLeaderboard = () => {
    const badge = document.querySelector('.vb-rank-badge');
    if (badge) fireEvent.click(badge);
  };
  openLeaderboard();
  return { ...props, openLeaderboard, rerender: (state: GameState, requests: string[] = joinRequests) => rerender(screen(state, requests)) };
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

  it('shows a stepped away label and offers only Remove for a Guest in Sit Out', () => {
    renderAs('host', stateWith([host, alex, satOut(sam)]));

    fireEvent.click(menuButton('Sam')!);

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([t('hostMenu.remove')]);
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

describe('Leaderboard disconnected marker', () => {
  const down = (player: TestPlayer): TestPlayer => ({ ...player, connected: false });

  it('shows the Host a marker on each Guest whose link is down, and clears it on reconnect', () => {
    const { rerender } = renderAs('host', stateWith([host, down(alex), sam]));

    expect(screen.getAllByText(t('leaderboard.disconnected'))).toHaveLength(1);

    rerender(stateWith([host, alex, sam]));

    expect(screen.queryByText(t('leaderboard.disconnected'))).toBeNull();
  });

  it('never shows a Guest the marker', () => {
    renderAs('guest', stateWith([host, down(sam), alex]));

    expect(screen.queryByText(t('leaderboard.disconnected'))).toBeNull();
  });

  it("never shows the marker on the Host's own row", () => {
    renderAs('host', stateWith([down(host), alex, sam]));

    expect(screen.queryByText(t('leaderboard.disconnected'))).toBeNull();
  });

  it('leaves the disconnected Guest active, with the usual menu', () => {
    renderAs('host', stateWith([host, down(alex), sam]));

    fireEvent.click(menuButton('Alex')!);

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([t('hostMenu.pause'), t('hostMenu.remove')]);
    expect(screen.queryByText(t('leaderboard.paused'))).toBeNull();
  });
});

describe('a Guest the Host paused', () => {
  const pausedState = () => stateWith([host, hostPaused(alex), sam]);

  it('sees that the Host paused them, not the live Round', () => {
    renderAs('guest', pausedState());

    expect(screen.getByText(t('hostPaused.title'))).toBeTruthy();
    expect(document.querySelector('.vb-tapzones')).toBeNull();
  });

  it('can still open the Leaderboard', () => {
    renderAs('guest', pausedState());

    expect(screen.getByRole('dialog', { name: 'Leaderboard' })).toBeTruthy();
  });

  it.each([
    ['Leave', 'homeDialog.leave', 'onLeave'],
    ['Sit out', 'homeDialog.sitOut', 'onSitOut'],
  ] as const)('can still %s', (_name, label, callback) => {
    const props = renderAs('guest', pausedState());

    fireEvent.click(screen.getByRole('link', { name: 'Home' }));
    fireEvent.click(screen.getByRole('button', { name: t(label) }));

    expect(props[callback]).toHaveBeenCalledWith(CODE);
  });

  it('returns to the live Round the moment the Host resumes them', () => {
    const { rerender } = renderAs('guest', pausedState());

    rerender(stateWith([host, alex, sam]));

    expect(screen.queryByText(t('hostPaused.title'))).toBeNull();
    expect(document.querySelector('.vb-tapzones')).not.toBeNull();
  });

  it('stays on the paused screen when a Round resolves, instead of seeing the Result Screen', () => {
    const { rerender } = renderAs('guest', stateWith([host, hostPaused(alex), sam]));
    const resolved: GameState = {
      ...stateWith([host, hostPaused(alex), sam]),
      round: null,
      resolution: { challengerId: 'host-1', outcome: 'YES', payouts: [{ playerId: 'guest-2', amount: 10 }] },
    };

    rerender(resolved);

    expect(screen.getByText(t('hostPaused.title'))).toBeTruthy();
    expect(screen.queryByText(t('result.succeeded', { name: 'Host' }))).toBeNull();
  });

  it('is not shown the paused screen after only sitting out', () => {
    renderAs('guest', stateWith([host, satOut(alex), sam]));

    expect(screen.queryByText(t('hostPaused.title'))).toBeNull();
  });
});

describe('Removing a Guest from the Leaderboard menu', () => {
  const openRemoveDialog = (name: string) => {
    fireEvent.click(menuButton(name)!);
    fireEvent.click(menuItem('hostMenu.remove')!);
  };
  const confirmDialog = (name: string) => screen.queryByRole('dialog', { name: t('removeGuest.title', { name }) });

  it('lists Remove after Pause and Resume, in red', () => {
    renderAs('host', stateWith([host, alex, hostPaused(sam)]));

    fireEvent.click(menuButton('Alex')!);
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([t('hostMenu.pause'), t('hostMenu.remove')]);
    expect(menuItem('hostMenu.remove')!.classList.contains('danger')).toBe(true);
    expect(menuItem('hostMenu.pause')!.classList.contains('danger')).toBe(false);

    fireEvent.click(menuButton('Alex')!);
    fireEvent.click(menuButton('Sam')!);
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([t('hostMenu.resume'), t('hostMenu.remove')]);
  });

  it('asks for confirmation naming the player, and removes nobody yet', () => {
    const { onRemoveGuest } = renderAs('host', stateWith([host, alex, sam]));

    openRemoveDialog('Sam');

    expect(confirmDialog('Sam')).not.toBeNull();
    expect(onRemoveGuest).not.toHaveBeenCalled();
  });

  it('changes nothing when the Host cancels', () => {
    const { onRemoveGuest } = renderAs('host', stateWith([host, alex, sam]));
    openRemoveDialog('Sam');

    fireEvent.click(screen.getByRole('button', { name: t('homeDialog.cancel') }));

    expect(confirmDialog('Sam')).toBeNull();
    expect(onRemoveGuest).not.toHaveBeenCalled();
    expect(menuButton('Sam')).not.toBeNull();
  });

  it('removes the named Guest once the Host confirms', () => {
    const { onRemoveGuest } = renderAs('host', stateWith([host, alex, sam]));
    openRemoveDialog('Sam');

    fireEvent.click(screen.getByRole('button', { name: t('hostMenu.remove') }));

    expect(onRemoveGuest).toHaveBeenCalledTimes(1);
    expect(onRemoveGuest).toHaveBeenCalledWith('guest-2');
    expect(confirmDialog('Sam')).toBeNull();
  });

  it('no longer lists the removed Guest on the Leaderboard', () => {
    const { rerender } = renderAs('host', stateWith([host, alex, sam]));

    rerender(stateWith([host, alex, { ...sam, status: 'removed' }]));

    expect(menuButton('Sam')).toBeNull();
    expect(within(screen.getByRole('dialog', { name: 'Leaderboard' })).queryByText(/Sam/)).toBeNull();
  });
});

describe('a Guest the Host removed', () => {
  const removedState = () => stateWith([host, { ...alex, status: 'removed' }, sam]);

  it('sees that the Host removed them, not the live Round', () => {
    renderAs('guest', removedState());

    expect(screen.getByText(t('removed.title'))).toBeTruthy();
    expect(document.querySelector('.vb-tapzones')).toBeNull();
  });

  it('is told to forget the Room, once', () => {
    const { onRemoved, rerender } = renderAs('guest', removedState());
    rerender(removedState());

    expect(onRemoved).toHaveBeenCalledTimes(1);
    expect(onRemoved).toHaveBeenCalledWith(CODE);
  });

  it('has one way back to Home', () => {
    renderAs('guest', removedState());

    const home = screen.getByRole('link', { name: t('gameResult.home') });
    expect(home.getAttribute('href')).toBe('/');
  });

  it('is not told anything while another player is removed', () => {
    const { onRemoved } = renderAs('guest', stateWith([host, alex, { ...sam, status: 'removed' }]));

    expect(onRemoved).not.toHaveBeenCalled();
    expect(screen.queryByText(t('removed.title'))).toBeNull();
  });

  it('still sees the removed screen, not the Game Result Screen, when the Room ends right after', () => {
    const { rerender } = renderAs('guest', removedState());

    rerender({ ...removedState(), status: 'ended', round: null });

    expect(screen.getByText(t('removed.title'))).toBeTruthy();
  });
});

describe('Join Requests on the Host screen', () => {
  const banner = (count: number) => screen.queryByRole('button', { name: t('joinRequest.banner', { count }) });
  const requestDialog = (name: string) => screen.queryByRole('dialog', { name: t('joinRequest.title', { name }) });

  it('shows no banner while nobody waits', () => {
    renderAs('host', stateWith([host, alex]));

    expect(document.querySelector('.vb-join-banner')).toBeNull();
  });

  it('shows the Host a banner with the number of waiting requests, which opens nothing by itself', () => {
    renderAs('host', stateWith([host, alex]), ['Kim', 'Lee']);

    expect(banner(2)).not.toBeNull();
    expect(requestDialog('Kim')).toBeNull();
  });

  it('keeps the banner next to the Host judging a Round, and keeps the count live', () => {
    const judging: GameState = { ...stateWith([host, alex]), round: { challengerId: 'host-1', challengeId: challengeBank[0].id, bets: [{ playerId: 'guest-1' }], outcome: null } };
    const { rerender } = renderAs('host', judging, ['Kim']);

    expect(screen.getByText(t('judge.subtitle'))).toBeTruthy();
    expect(banner(1)).not.toBeNull();

    rerender(judging, ['Kim', 'Lee', 'Max']);

    expect(banner(3)).not.toBeNull();
  });

  it('never shows a Guest the banner', () => {
    renderAs('guest', stateWith([host, alex]), ['Kim']);

    expect(document.querySelector('.vb-join-banner')).toBeNull();
  });

  it('opens a dialog naming the oldest requester, with Approve and Decline', () => {
    renderAs('host', stateWith([host, alex]), ['Kim', 'Lee']);

    fireEvent.click(banner(2)!);

    expect(requestDialog('Kim')).not.toBeNull();
    expect(screen.getByRole('button', { name: t('joinRequest.approve') })).toBeTruthy();
    expect(screen.getByRole('button', { name: t('joinRequest.decline') })).toBeTruthy();
  });

  it('admits when the Host approves, and closes the dialog', () => {
    const { onAdmitJoin, onDeclineJoin } = renderAs('host', stateWith([host, alex]), ['Kim']);
    fireEvent.click(banner(1)!);

    fireEvent.click(screen.getByRole('button', { name: t('joinRequest.approve') }));

    expect(onAdmitJoin).toHaveBeenCalledTimes(1);
    expect(onAdmitJoin).toHaveBeenCalledWith(100);
    expect(onDeclineJoin).not.toHaveBeenCalled();
    expect(requestDialog('Kim')).toBeNull();
  });

  describe('the starting Points field', () => {
    const pointsField = () => screen.getByLabelText(t('joinRequest.points')) as HTMLInputElement;
    const approve = () => screen.getByRole('button', { name: t('joinRequest.approve') }) as HTMLButtonElement;
    const typePoints = (value: string) => fireEvent.input(pointsField(), { target: { value } });

    function openDialogFor(players: TestPlayer[]) {
      const rendered = renderAs('host', stateWith(players), ['Kim']);
      fireEvent.click(banner(1)!);
      return rendered;
    }

    it('starts with the lowest Points among active players, the Host included', () => {
      openDialogFor([{ ...host, points: 80 }, { ...alex, points: 120 }, { ...sam, points: 95 }]);

      expect(pointsField().value).toBe('80');
    });

    it('does not count Paused or Removed players in the default', () => {
      const removed: TestPlayer = { playerId: 'guest-3', name: 'Max', points: 5, status: 'removed', connected: false };
      openDialogFor([host, { ...alex, points: 90 }, { ...hostPaused(sam), points: 10 }, removed]);

      expect(pointsField().value).toBe('90');
    });

    it('admits with the Points the Host typed, with no upper cap', () => {
      const { onAdmitJoin } = openDialogFor([host, alex]);

      typePoints('5000');
      fireEvent.click(approve());

      expect(onAdmitJoin).toHaveBeenCalledWith(5000);
    });

    it.each([
      ['empty', ''],
      ['zero', '0'],
      ['negative', '-5'],
      ['fractional', '2.5'],
    ])('refuses %s with a visible reason and keeps Approve unavailable', (_name, value) => {
      const { onAdmitJoin } = openDialogFor([host, alex]);

      typePoints(value);
      fireEvent.click(approve());

      expect(screen.getByText(t('joinRequest.points.invalid'))).toBeTruthy();
      expect(approve().disabled).toBe(true);
      expect(onAdmitJoin).not.toHaveBeenCalled();
    });

    it('shows no reason for the default and lets Approve through once a bad value is fixed', () => {
      const { onAdmitJoin } = openDialogFor([host, alex]);
      expect(screen.queryByText(t('joinRequest.points.invalid'))).toBeNull();

      typePoints('0');
      typePoints('40');
      fireEvent.click(approve());

      expect(screen.queryByText(t('joinRequest.points.invalid'))).toBeNull();
      expect(onAdmitJoin).toHaveBeenCalledWith(40);
    });

    it('still lets the Host decline while the Points are invalid', () => {
      const { onDeclineJoin } = openDialogFor([host, alex]);

      typePoints('');
      fireEvent.click(screen.getByRole('button', { name: t('joinRequest.decline') }));

      expect(onDeclineJoin).toHaveBeenCalledTimes(1);
    });
  });

  it('declines when the Host declines, and closes the dialog', () => {
    const { onAdmitJoin, onDeclineJoin } = renderAs('host', stateWith([host, alex]), ['Kim']);
    fireEvent.click(banner(1)!);

    fireEvent.click(screen.getByRole('button', { name: t('joinRequest.decline') }));

    expect(onDeclineJoin).toHaveBeenCalledTimes(1);
    expect(onAdmitJoin).not.toHaveBeenCalled();
    expect(requestDialog('Kim')).toBeNull();
  });

  it('shows the next request in arrival order once the Host has answered the first', () => {
    const { rerender } = renderAs('host', stateWith([host, alex]), ['Kim', 'Lee']);
    fireEvent.click(banner(2)!);
    fireEvent.click(screen.getByRole('button', { name: t('joinRequest.decline') }));

    rerender(stateWith([host, alex]), ['Lee']);

    expect(banner(1)).not.toBeNull();
    expect(requestDialog('Kim')).toBeNull();
    fireEvent.click(banner(1)!);
    expect(requestDialog('Lee')).not.toBeNull();
  });

  it('never shows a request that was cancelled while queued', () => {
    const { rerender } = renderAs('host', stateWith([host, alex]), ['Kim', 'Lee']);

    rerender(stateWith([host, alex]), ['Lee']);
    fireEvent.click(banner(1)!);

    expect(requestDialog('Kim')).toBeNull();
    expect(requestDialog('Lee')).not.toBeNull();
  });

  it('closes the dialog instead of switching to the next request when the open one is cancelled', () => {
    const { rerender } = renderAs('host', stateWith([host, alex]), ['Kim', 'Lee']);
    fireEvent.click(banner(2)!);

    rerender(stateWith([host, alex]), ['Lee']);

    expect(requestDialog('Kim')).toBeNull();
    expect(requestDialog('Lee')).toBeNull();
    expect(banner(1)).not.toBeNull();
  });

  it('does not open the dialog by itself for a request that arrives after the open one was cancelled', () => {
    const { rerender } = renderAs('host', stateWith([host, alex]), ['Kim']);
    fireEvent.click(banner(1)!);

    rerender(stateWith([host, alex]), []);
    rerender(stateWith([host, alex]), ['Lee']);

    expect(requestDialog('Lee')).toBeNull();
    expect(banner(1)).not.toBeNull();
  });

  it('answers nothing when the Host dismisses the dialog, and the request keeps waiting', () => {
    const { onAdmitJoin, onDeclineJoin } = renderAs('host', stateWith([host, alex]), ['Kim']);
    fireEvent.click(banner(1)!);

    fireEvent.click(document.querySelector('.vb-dialog-backdrop')!);

    expect(requestDialog('Kim')).toBeNull();
    expect(onAdmitJoin).not.toHaveBeenCalled();
    expect(onDeclineJoin).not.toHaveBeenCalled();
    expect(banner(1)).not.toBeNull();
  });

  it('closes the dialog when its request goes away, e.g. the Guest cancelled', () => {
    const { rerender } = renderAs('host', stateWith([host, alex]), ['Kim']);
    fireEvent.click(banner(1)!);

    rerender(stateWith([host, alex]), []);

    expect(document.querySelector('.vb-dialog')).toBeNull();
    expect(document.querySelector('.vb-join-banner')).toBeNull();
  });
});
