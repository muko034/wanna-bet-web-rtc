import { render, screen } from '@testing-library/preact';
import { act } from 'preact/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { dictionaries } from './i18n/dictionaries';
import { translate } from './i18n/translate';
import { withBase } from './base-path';
import { saveHostSession, type HostSession } from './host-persistence/host-session-store';
import { ConnectionManager } from './room-lifecycle/connection-manager';
import type { Room } from './room-lifecycle/room';
import { FakeTransport } from './transport/fake-transport';
import type { RecoverableTransport } from './transport/transport';

type StubProps = Record<string, unknown>;

const { createTransport, screenProps } = vi.hoisted(() => ({
  createTransport: vi.fn(),
  screenProps: {} as Record<'Lobby' | 'StartedGame' | 'JoinRoom', StubProps>,
}));

vi.mock('./transport/create-peerjs-transport', () => ({ createPeerJsTransport: createTransport }));

// Screens are stubbed to record the props `App` hands them; their own behaviour has its own tests.
vi.mock('./room-lifecycle/Lobby', async () => {
  const { h } = await import('preact');
  return { Lobby: (props: StubProps) => ((screenProps.Lobby = props), h('div', null, `lobby ${props.code}`)) };
});
vi.mock('./room-lifecycle/StartedGame', async () => {
  const { h } = await import('preact');
  return { StartedGame: (props: StubProps) => ((screenProps.StartedGame = props), h('div', null, `play ${props.code}`)) };
});
vi.mock('./room-lifecycle/JoinRoom', async () => {
  const { h } = await import('preact');
  return { JoinRoom: (props: StubProps) => ((screenProps.JoinRoom = props), h('div', null, `join ${props.code}`)) };
});

class RecoverableFakeTransport extends FakeTransport implements RecoverableTransport {
  recover = vi.fn(async () => true);
}

const CODE = 'ABCDEF';

/** A real Lobby or started-game session, captured from a `ConnectionManager`'s autosave. */
function hostSession(started: boolean): HostSession {
  let session!: HostSession;
  const room: Room = { code: CODE, hostName: 'Host', hostPlayerId: 'host-1', players: [], playerCount: 1, started };
  const manager = new ConnectionManager(new FakeTransport(), room, () => {}, undefined, undefined, () => {}, (s) => (session = s));
  if (started) {
    manager.room = { ...room, started: true };
    manager.startGame();
  }
  return session;
}

function openAt(path: string, session?: HostSession): void {
  if (session) saveHostSession(localStorage, session);
  window.history.replaceState(null, '', withBase(path));
}

async function renderApp() {
  const view = render(<App />);
  await act(async () => {});
  await act(async () => {}); // the landing route change renders one tick after the reopen settles
  return view;
}

const becomeVisible = () => act(async () => { document.dispatchEvent(new Event('visibilitychange')); });

let hostTransport: RecoverableFakeTransport;

beforeEach(() => {
  for (const name of Object.keys(screenProps)) delete screenProps[name as keyof typeof screenProps];
  hostTransport = new RecoverableFakeTransport();
  createTransport.mockReset().mockImplementation(() => hostTransport);
  vi.restoreAllMocks();
});

describe('App mount-time reopen', () => {
  it('reopens the Host Room on its own link when a session is stored', async () => {
    openAt(`room/${CODE}`, hostSession(false));

    await renderApp();

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(screen.getByText(`lobby ${CODE}`)).toBeTruthy();
    expect(screenProps.Lobby.room).toEqual(expect.objectContaining({ code: CODE }));
  });

  it('reopens a started game on its play view, through preact-router', async () => {
    openAt(`room/${CODE}/play`, hostSession(true));

    await renderApp();

    expect(screen.getByText(`play ${CODE}`)).toBeTruthy();
    expect(window.location.pathname).toBe(withBase(`room/${CODE}/play`));
    expect(screenProps.StartedGame.gameState).toEqual(expect.objectContaining({ status: 'active' }));
  });

  it('does not reopen when no session is stored for the link', async () => {
    openAt(`room/${CODE}`);

    await renderApp();

    expect(createTransport).not.toHaveBeenCalled();
    expect(screen.getByText(`join ${CODE}`)).toBeTruthy();
  });

  it('does not reopen on a non-Room link even when a session is stored', async () => {
    saveHostSession(localStorage, hostSession(false));
    openAt('join');

    await renderApp();

    expect(createTransport).not.toHaveBeenCalled();
  });
});

describe('App Host recovery on visibilitychange', () => {
  it('recovers the Host transport and rebroadcasts state', async () => {
    const rebroadcast = vi.spyOn(ConnectionManager.prototype, 'rebroadcastState');
    openAt(`room/${CODE}`, hostSession(false));
    await renderApp();

    await becomeVisible();

    expect(hostTransport.recover).toHaveBeenCalledTimes(1);
    expect(rebroadcast).toHaveBeenCalledTimes(1);
  });

  it('shows the connection-lost banner and does not rebroadcast when recovery fails', async () => {
    const rebroadcast = vi.spyOn(ConnectionManager.prototype, 'rebroadcastState');
    openAt(`room/${CODE}`, hostSession(false));
    await renderApp();
    hostTransport.recover.mockResolvedValue(false);

    await becomeVisible();

    expect(rebroadcast).not.toHaveBeenCalled();
    expect(screen.getByText(translate(dictionaries.pl, 'hostLost.message'))).toBeTruthy();
  });

  it('does nothing when this device hosts no Room', async () => {
    openAt(`room/${CODE}`);
    await renderApp();

    await becomeVisible();

    expect(hostTransport.recover).not.toHaveBeenCalled();
  });
});

describe('App screen wiring', () => {
  it('gives the Lobby the Host Room and state', async () => {
    openAt(`room/${CODE}`, hostSession(false));

    await renderApp();

    expect(screenProps.Lobby).toEqual(
      expect.objectContaining({ code: CODE, room: expect.objectContaining({ code: CODE }), gameState: expect.objectContaining({ status: 'lobby' }) }),
    );
  });

  it('starts the game from the Lobby and moves to the play view with the new state', async () => {
    const session = hostSession(false);
    const guest = { playerId: 'guest-1', name: 'Alex', connected: true };
    openAt(`room/${CODE}`, { ...session, room: { ...session.room, players: [guest], playerCount: 2 } });
    await renderApp();

    await act(async () => (screenProps.Lobby.onStart as () => void)());

    expect(window.location.pathname).toBe(withBase(`room/${CODE}/play`));
    expect(screenProps.StartedGame).toEqual(
      expect.objectContaining({
        room: expect.objectContaining({ code: CODE, started: true }),
        gameState: expect.objectContaining({ status: 'active' }),
      }),
    );
  });

  it('gives StartedGame its state and callbacks on the play view', async () => {
    openAt(`room/${CODE}/play`, hostSession(true));

    await renderApp();

    expect(screenProps.StartedGame).toEqual(
      expect.objectContaining({
        code: CODE,
        guestGameStartedCode: null,
        betFailedRoundKey: null,
        room: expect.objectContaining({ code: CODE }),
        gameState: expect.objectContaining({ roomId: CODE }),
        onPlaceBet: expect.any(Function),
        onResolveRound: expect.any(Function),
        onRedraw: expect.any(Function),
        onHostLeave: expect.any(Function),
        onLeave: expect.any(Function),
        onSitOut: expect.any(Function),
        createGuestTransport: expect.any(Function),
      }),
    );
  });

  it('gives the Guest join screen no Room and the guest transport factory on an unknown Room link', async () => {
    openAt(`room/${CODE}`);

    await renderApp();

    expect(screenProps.JoinRoom).toEqual(
      expect.objectContaining({ code: CODE, gameState: null, createGuestTransport: expect.any(Function), isSatOut: expect.any(Function) }),
    );
  });

  it('hands the Guest screens the factory transport, and closes it when a new one is requested', async () => {
    openAt(`room/${CODE}`);
    await renderApp();
    const first = new FakeTransport();
    const second = new FakeTransport();
    createTransport.mockReset().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const closeFirst = vi.spyOn(first, 'close');
    const create = screenProps.JoinRoom.createGuestTransport as () => FakeTransport;

    expect(create()).toBe(first);
    expect(create()).toBe(second);

    expect(closeFirst).toHaveBeenCalledTimes(1);
  });
});
