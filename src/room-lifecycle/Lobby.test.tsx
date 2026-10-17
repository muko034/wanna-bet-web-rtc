import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { dictionaries, type MessageKey } from '../i18n/dictionaries';
import { translate } from '../i18n/translate';
import type { MessageParams } from '../i18n/translate';
import type { GameState } from '../protocol/messages';
import { Lobby } from './Lobby';
import type { Room } from './room';

const CODE = 'ABCDEF';
const room: Room = {
  code: CODE,
  hostName: 'Host',
  hostPlayerId: 'host-1',
  players: [
    { playerId: 'guest-1', name: 'Alex', connected: true },
    { playerId: 'guest-2', name: 'Sam', connected: true },
  ],
  playerCount: 3,
  started: false,
};

type TestPlayer = GameState['players'][number];
const host: TestPlayer = { playerId: 'host-1', name: 'Host', points: 100, status: 'active', connected: true };
const alex: TestPlayer = { playerId: 'guest-1', name: 'Alex', points: 100, status: 'active', connected: true };
const sam: TestPlayer = { playerId: 'guest-2', name: 'Sam', points: 100, status: 'active', connected: true };

const lobbyState = (players: TestPlayer[]): GameState => ({ roomId: CODE, status: 'lobby', challengerId: null, resolution: null, round: null, players });

const t = (key: MessageKey, params?: MessageParams) => translate(dictionaries.pl, key, params);

function renderLobby(players: TestPlayer[]) {
  const onRemoveGuest = vi.fn();
  const view = render(<Lobby code={CODE} room={room} gameState={lobbyState(players)} onStart={vi.fn()} onRemoveGuest={onRemoveGuest} />);
  return { ...view, onRemoveGuest };
}

const removeButton = (name: string) => screen.queryByRole('button', { name: t('lobby.removeGuest', { name }) });
const confirmDialog = (name: string) => screen.queryByRole('dialog', { name: t('removeGuest.title', { name }) });

describe('the Host\'s Lobby roster', () => {
  it('makes each Guest row tappable to remove and the Host\'s own row inert', () => {
    renderLobby([host, alex, sam]);

    expect(removeButton('Alex')).not.toBeNull();
    expect(removeButton('Sam')).not.toBeNull();
    expect(removeButton('Host')).toBeNull();
  });

  it('asks for confirmation naming the player, and removes nobody yet', () => {
    const { onRemoveGuest } = renderLobby([host, alex, sam]);

    fireEvent.click(removeButton('Sam')!);

    expect(confirmDialog('Sam')).not.toBeNull();
    expect(onRemoveGuest).not.toHaveBeenCalled();
  });

  it('changes nothing when the Host cancels', () => {
    const { onRemoveGuest } = renderLobby([host, alex, sam]);
    fireEvent.click(removeButton('Sam')!);

    fireEvent.click(screen.getByRole('button', { name: t('homeDialog.cancel') }));

    expect(confirmDialog('Sam')).toBeNull();
    expect(onRemoveGuest).not.toHaveBeenCalled();
    expect(removeButton('Sam')).not.toBeNull();
  });

  it('removes the named Guest once the Host confirms', () => {
    const { onRemoveGuest } = renderLobby([host, alex, sam]);
    fireEvent.click(removeButton('Sam')!);

    fireEvent.click(screen.getByRole('button', { name: t('hostMenu.remove') }));

    expect(onRemoveGuest).toHaveBeenCalledTimes(1);
    expect(onRemoveGuest).toHaveBeenCalledWith('guest-2');
    expect(confirmDialog('Sam')).toBeNull();
  });

  it('hints that a Guest can be tapped to remove, only while a Guest is listed', () => {
    const { unmount } = renderLobby([host, alex]);
    expect(screen.queryByText(t('lobby.removeHint'))).not.toBeNull();
    unmount();

    renderLobby([host]);
    expect(screen.queryByText(t('lobby.removeHint'))).toBeNull();
  });

  it('never renders a removed row', () => {
    renderLobby([host, alex, { ...sam, status: 'removed' }]);

    expect(screen.queryByText('Sam')).toBeNull();
    expect(removeButton('Sam')).toBeNull();
    expect(removeButton('Alex')).not.toBeNull();
  });
});
