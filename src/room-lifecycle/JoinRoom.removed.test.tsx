import { render, screen } from '@testing-library/preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dictionaries } from '../i18n/dictionaries';
import { translate } from '../i18n/translate';
import type { GameState } from '../protocol/messages';
import { JoinRoom } from './JoinRoom';
import { hostRoomWithStoredGuest, trackedGuestTransports } from './guest-test-harness';
import { loadIdentity, saveIdentity } from './player-identity';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const removedTitle = () => screen.queryByText(translate(dictionaries.pl, 'removed.title'));

function lobbyState(code: string, players: GameState['players']): GameState {
  return { roomId: code, status: 'lobby', challengerId: null, resolution: null, round: null, players };
}

function renderJoinRoom(code: string, gameState: GameState | null = null) {
  const { createGuestTransport } = trackedGuestTransports();
  const props = {
    code,
    onGameStarted: vi.fn(),
    onGameState: vi.fn(),
    gameState,
    onPlaceBetReady: vi.fn(),
    onBetRejected: vi.fn(),
    onConnectionLost: vi.fn(),
    createGuestTransport,
    isSatOut: () => false,
    onLeave: vi.fn(),
    onSitOut: vi.fn(),
    onRemoved: vi.fn(),
  };
  return { ...render(<JoinRoom {...props} />), props };
}

describe('a Guest the Host removed in the Lobby', () => {
  it('shows "The Host removed you", with a way back to Home, once the Lobby snapshot lists them as removed', async () => {
    const code = await hostRoomWithStoredGuest();
    const { playerId } = loadIdentity(localStorage, code)!;
    const { rerender, props } = renderJoinRoom(code);
    await settle();
    expect(removedTitle()).toBeNull();

    rerender(<JoinRoom {...props} gameState={lobbyState(code, [{ playerId, name: 'Alex', points: 100, status: 'removed', connected: true }])} />);
    await settle();

    expect(removedTitle()).not.toBeNull();
    expect(screen.getByRole('link', { name: translate(dictionaries.pl, 'gameResult.home') })).not.toBeNull();
    expect(props.onRemoved).toHaveBeenCalledWith(code);
  });

  it('keeps the removed screen when the next snapshot no longer lists them', async () => {
    const code = await hostRoomWithStoredGuest();
    const { playerId } = loadIdentity(localStorage, code)!;
    const { rerender, props } = renderJoinRoom(code);
    await settle();
    rerender(<JoinRoom {...props} gameState={lobbyState(code, [{ playerId, name: 'Alex', points: 100, status: 'removed', connected: true }])} />);
    await settle();

    rerender(<JoinRoom {...props} gameState={lobbyState(code, [])} />);
    await settle();

    expect(removedTitle()).not.toBeNull();
  });

  it('ignores a removed row of another player, or of another Room', async () => {
    const code = await hostRoomWithStoredGuest();
    const { playerId } = loadIdentity(localStorage, code)!;
    const { rerender, props } = renderJoinRoom(code);
    await settle();

    rerender(<JoinRoom {...props} gameState={lobbyState(code, [{ playerId: 'someone-else', name: 'Sam', points: 100, status: 'removed', connected: true }])} />);
    await settle();
    rerender(<JoinRoom {...props} gameState={lobbyState('ZZZZZZ', [{ playerId, name: 'Alex', points: 100, status: 'removed', connected: true }])} />);
    await settle();

    expect(removedTitle()).toBeNull();
    expect(props.onRemoved).not.toHaveBeenCalled();
  });

  it('shows the same screen when a later rejoin is refused with UNKNOWN_PLAYER', async () => {
    const code = await hostRoomWithStoredGuest();
    saveIdentity(localStorage, code, { playerId: 'gone', reconnectToken: 'a-token-the-Host-deleted' });

    const { props } = renderJoinRoom(code);
    await settle();

    expect(removedTitle()).not.toBeNull();
    expect(props.onRemoved).toHaveBeenCalledWith(code);
  });
});
