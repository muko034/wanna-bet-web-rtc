import { fireEvent, render, screen } from '@testing-library/preact';
import { route } from 'preact-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withBase } from '../base-path';
import { challengeBank } from '../challenge-bank/challenge-bank';
import { dictionaries, type MessageKey } from '../i18n/dictionaries';
import { translate } from '../i18n/translate';
import type { GameState } from '../protocol/messages';
import { StartedGame } from './StartedGame';
import { saveIdentity } from './player-identity';
import type { Room } from './room';

vi.mock('preact-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('preact-router')>()),
  route: vi.fn(),
}));

const CODE = 'ABCDEF';
const room: Room = { code: CODE, hostName: 'Host', hostPlayerId: 'host-1', players: [], playerCount: 1, started: true };
const gameState: GameState = {
  roomId: CODE,
  status: 'active',
  challengerId: 'host-1',
  resolution: null,
  round: { challengerId: 'host-1', challengeId: challengeBank[0].id, bets: [], outcome: null },
  players: [
    { playerId: 'host-1', name: 'Host', points: 100, status: 'active', connected: true },
    { playerId: 'guest-1', name: 'Alex', points: 100, status: 'active', connected: true },
  ],
};

const t = (key: MessageKey) => translate(dictionaries.pl, key);

function renderAs(role: 'host' | 'guest') {
  const noop = vi.fn();
  const props = { onLeave: vi.fn(), onSitOut: vi.fn(), onHostLeave: vi.fn() };
  if (role === 'guest') {
    saveIdentity(localStorage, CODE, { playerId: 'guest-1', reconnectToken: 'token' });
  }
  render(
    <StartedGame
      code={CODE}
      room={role === 'host' ? room : null}
      guestGameStartedCode={role === 'guest' ? CODE : null}
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
      createGuestTransport={() => {
        throw new Error('must not open a Guest transport');
      }}
      isSatOut={() => false}
      {...props}
    />,
  );
  fireEvent.click(screen.getByRole('link', { name: t('exit.label') }));
  return props;
}

const choose = (label: MessageKey) => fireEvent.click(screen.getByRole('button', { name: t(label) }));
const dialogButtons = () => screen.getAllByRole('button').filter((button) => button.closest('.vb-dialog'));

beforeEach(() => vi.mocked(route).mockClear());

describe("the Host's Exit dialog", () => {
  it('offers End game (destructive), Exit and Stay', () => {
    renderAs('host');

    expect(dialogButtons().map((button) => button.textContent)).toEqual([t('homeDialog.endGame'), t('homeDialog.exit'), t('homeDialog.stay')]);
    expect(screen.getByRole('button', { name: t('homeDialog.endGame') }).classList.contains('vb-dialog-destructive')).toBe(true);
  });

  it('End game ends the Room for everyone', () => {
    const { onHostLeave } = renderAs('host');

    choose('homeDialog.endGame');

    expect(onHostLeave).toHaveBeenCalledOnce();
  });

  it('Exit goes Home and leaves the Room open', () => {
    const { onHostLeave } = renderAs('host');

    choose('homeDialog.exit');

    expect(route).toHaveBeenCalledWith(withBase('/'));
    expect(onHostLeave).not.toHaveBeenCalled();
  });

  it('Stay closes the dialog and changes nothing', () => {
    const { onHostLeave } = renderAs('host');

    choose('homeDialog.stay');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onHostLeave).not.toHaveBeenCalled();
    expect(route).not.toHaveBeenCalled();
  });
});

describe("a Guest's Exit dialog", () => {
  it('offers Leave (destructive), Sit out and Stay', () => {
    renderAs('guest');

    expect(dialogButtons().map((button) => button.textContent)).toEqual([t('homeDialog.leave'), t('homeDialog.sitOut'), t('homeDialog.stay')]);
    expect(screen.getByRole('button', { name: t('homeDialog.leave') }).classList.contains('vb-dialog-destructive')).toBe(true);
  });

  it('Leave gives up their place', () => {
    const { onLeave } = renderAs('guest');

    choose('homeDialog.leave');

    expect(onLeave).toHaveBeenCalledWith(CODE);
  });

  it('Sit out steps out of the Game', () => {
    const { onSitOut } = renderAs('guest');

    choose('homeDialog.sitOut');

    expect(onSitOut).toHaveBeenCalledWith(CODE);
  });

  it('Stay closes the dialog and changes nothing', () => {
    const { onLeave, onSitOut } = renderAs('guest');

    choose('homeDialog.stay');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onLeave).not.toHaveBeenCalled();
    expect(onSitOut).not.toHaveBeenCalled();
  });
});
