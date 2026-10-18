import { fireEvent, render, screen } from '@testing-library/preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dictionaries, type MessageKey } from '../i18n/dictionaries';
import { translate } from '../i18n/translate';
import { JoinRoom } from './JoinRoom';
import { HOST_SILENCE_TIMEOUT_MS } from './join-room';
import { hostStartedRoom, trackedGuestTransports } from './guest-test-harness';
import { HEARTBEAT_INTERVAL_MS } from './connection-manager';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const t = (key: MessageKey) => translate(dictionaries.pl, key);
const settle = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

function renderJoinRoom(code: string) {
  const { createGuestTransport, transports, closedCount } = trackedGuestTransports();
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
    onRemoved: vi.fn(),
  };
  return { ...render(<JoinRoom {...props} />), props, transports, closedCount };
}

async function askToJoin(name = 'Latecomer') {
  fireEvent.input(screen.getByPlaceholderText(t('form.namePlaceholder')), { target: { value: name } });
  fireEvent.submit(screen.getByRole('button', { name: t('joinRoom.submit') }).closest('form')!);
  await settle();
}

const waitingTitle = () => screen.queryByText(t('joinRoom.waiting.title'));

describe('a Guest waiting to be let into a started Game', () => {
  it('sees "Waiting for the Host to let you in" once the request is sent', async () => {
    const { code } = await hostStartedRoom();
    renderJoinRoom(code);

    await askToJoin();

    expect(waitingTitle()).not.toBeNull();
  });

  it('keeps waiting, with no reply timeout, for as long as the Host is alive', async () => {
    const { code } = await hostStartedRoom();
    renderJoinRoom(code);
    await askToJoin();

    await settle(10 * 60_000);

    expect(waitingTitle()).not.toBeNull();
    expect(screen.queryByText(t('joinRoom.unreachableTitle'))).toBeNull();
  });

  it('ignores the Host\'s state broadcasts, so it never lands in the Game before it is admitted', async () => {
    const { code } = await hostStartedRoom();
    const { props } = renderJoinRoom(code);
    await askToJoin();

    await settle(HEARTBEAT_INTERVAL_MS * 3);

    expect(props.onGameState).not.toHaveBeenCalled();
    expect(props.onGameStarted).not.toHaveBeenCalled();
  });

  it('enters the Game once the Host admits, with the Game state', async () => {
    const { code, manager } = await hostStartedRoom();
    const { props } = renderJoinRoom(code);
    await askToJoin();

    act(() => manager.admitJoinRequest(100));
    await settle();

    expect(props.onGameStarted).toHaveBeenCalledWith(code);
    expect(props.onGameState).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));
    expect(props.onPlaceBetReady).toHaveBeenLastCalledWith(expect.any(Function));
  });

  it('sees a message on the form when the Host declines, and can ask again', async () => {
    const { code, manager } = await hostStartedRoom();
    renderJoinRoom(code);
    await askToJoin();

    act(() => manager.declineJoinRequest());
    await settle();

    expect(screen.getByText(t('joinRoom.error.declined'))).not.toBeNull();
    expect(waitingTitle()).toBeNull();
    await askToJoin();
    expect(waitingTitle()).not.toBeNull();
    expect(manager.joinRequests.map((request) => request.name)).toEqual(['Latecomer']);
  });

  it('withdraws the request with Cancel: back on the form, and the Host no longer has the request', async () => {
    const { code, manager } = await hostStartedRoom();
    renderJoinRoom(code);
    await askToJoin();

    fireEvent.click(screen.getByRole('button', { name: t('homeDialog.cancel') }));
    await settle();

    expect(waitingTitle()).toBeNull();
    expect(screen.getByPlaceholderText(t('form.namePlaceholder'))).not.toBeNull();
    expect(manager.joinRequests).toEqual([]);
  });

  it('ends in "can\'t reach the Host" when the Host goes silent for 9 s', async () => {
    const { code, hostTransport } = await hostStartedRoom();
    const { props } = renderJoinRoom(code);
    await askToJoin();

    hostTransport.setBlackHole(true);
    await settle(HOST_SILENCE_TIMEOUT_MS);

    expect(screen.getByText(t('joinRoom.unreachableTitle'))).not.toBeNull();
    expect(waitingTitle()).toBeNull();
    expect(props.onGameState).not.toHaveBeenCalled();
  });

  it('ends in "can\'t reach the Host" at once when the Host reloads, since its queue is gone', async () => {
    const { code, hostTransport, manager } = await hostStartedRoom();
    renderJoinRoom(code);
    await askToJoin();
    expect(manager.joinRequests).toHaveLength(1);

    hostTransport.close();
    await settle();

    expect(screen.getByText(t('joinRoom.unreachableTitle'))).not.toBeNull();
    expect(waitingTitle()).toBeNull();
  });

  it('can ask again from "can\'t reach the Host"', async () => {
    const { code, hostTransport } = await hostStartedRoom();
    renderJoinRoom(code);
    await askToJoin();
    hostTransport.setBlackHole(true);
    await settle(HOST_SILENCE_TIMEOUT_MS);

    fireEvent.click(screen.getByRole('button', { name: t('joinRoom.retry') }));
    await settle();

    expect(screen.getByPlaceholderText(t('form.namePlaceholder'))).not.toBeNull();
  });

  it('does not report the Host silent after Cancel', async () => {
    const { code, hostTransport } = await hostStartedRoom();
    renderJoinRoom(code);
    await askToJoin();
    fireEvent.click(screen.getByRole('button', { name: t('homeDialog.cancel') }));
    await settle();

    hostTransport.setBlackHole(true);
    await settle(HOST_SILENCE_TIMEOUT_MS * 2);

    expect(screen.queryByText(t('joinRoom.unreachableTitle'))).toBeNull();
  });
});
