import { render, screen } from '@testing-library/preact';
import { act } from 'preact/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dictionaries } from '../i18n/dictionaries';
import { translate } from '../i18n/translate';
import { JoinRoom } from './JoinRoom';
import { hostRoomWithStoredGuest, storeStaleIdentity, trackedGuestTransports } from './guest-test-harness';

beforeEach(() => vi.useFakeTimers());

const GIVE_UP_MS = 6 * 60_000;

const settle = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

function renderJoinRoom(code: string, createGuestTransport: () => ReturnType<ReturnType<typeof trackedGuestTransports>['createGuestTransport']>) {
  const props = {
    code,
    onGameStarted: vi.fn(),
    onGameState: vi.fn(),
    gameState: null,
    onPlaceBetReady: vi.fn(),
    onBetRejected: vi.fn(),
    onConnectionLost: vi.fn(),
    createGuestTransport,
    isSatOut: () => false,
    onLeave: vi.fn(),
    onSitOut: vi.fn(),
  };
  return { ...render(<JoinRoom {...props} />), props };
}

const retryButton = () => screen.getByRole('button', { name: translate(dictionaries.pl, 'joinRoom.retry') });

describe('JoinRoom reconnect effect', () => {
  it('closes the Transport when the attempt is abandoned mid-flight, and not after it has settled', async () => {
    const { transports, createGuestTransport, closedCount } = trackedGuestTransports();
    storeStaleIdentity('ABCDEF');
    const { rerender, props } = renderJoinRoom('ABCDEF', createGuestTransport);
    await settle();

    rerender(<JoinRoom {...props} code="GHJKLM" />);

    expect(closedCount(transports[0])).toBe(1);
  });

  it('leaves a joined Transport open when the screen unmounts', async () => {
    const { transports, createGuestTransport, closedCount } = trackedGuestTransports();
    const code = await hostRoomWithStoredGuest();
    const { unmount } = renderJoinRoom(code, createGuestTransport);
    await settle();

    unmount();

    expect(closedCount(transports[0])).toBe(0);
  });

  it('restarts the attempt on a new Room Code', async () => {
    const { transports, createGuestTransport, closedCount } = trackedGuestTransports();
    storeStaleIdentity('ABCDEF');
    storeStaleIdentity('GHJKLM');
    const { rerender, props } = renderJoinRoom('ABCDEF', createGuestTransport);
    await settle();

    rerender(<JoinRoom {...props} code="GHJKLM" />);
    await settle();

    expect(transports).toHaveLength(2);
    expect(closedCount(transports[0])).toBe(1);
    expect(closedCount(transports[1])).toBe(0);
  });

  it('restarts the attempt on Retry, without closing the settled one', async () => {
    const { transports, createGuestTransport, closedCount } = trackedGuestTransports();
    storeStaleIdentity('ABCDEF');
    renderJoinRoom('ABCDEF', createGuestTransport);
    await settle(GIVE_UP_MS);

    await act(async () => retryButton().click());
    await settle();

    expect(transports).toHaveLength(2);
    expect(closedCount(transports[0])).toBe(0);
  });

  it('leaves no open Transport when unmounted mid-attempt', async () => {
    const { transports, createGuestTransport, closedCount } = trackedGuestTransports();
    storeStaleIdentity('ABCDEF');
    const { unmount } = renderJoinRoom('ABCDEF', createGuestTransport);
    await settle(5_000);

    unmount();

    expect(transports.every((transport) => closedCount(transport) === 1)).toBe(true);
  });
});
