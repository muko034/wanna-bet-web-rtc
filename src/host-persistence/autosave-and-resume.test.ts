import { describe, expect, it } from 'vitest';
import { FakeStorage } from '../fake-storage';
import { GuestProtocol } from '../protocol/guest-protocol';
import { ConnectionManager } from '../room-lifecycle/connection-manager';
import type { Room } from '../room-lifecycle/room';
import { FakeTransport } from '../transport/fake-transport';
import { loadHostSession, saveHostSession } from './host-session-store';

function lobbyRoom(): Room {
  return { code: 'ABCDEF', hostName: 'Host', hostPlayerId: 'host-1', players: [], playerCount: 1, started: false };
}

async function joinGuest(hostId: string, name: string) {
  const guestTransport = new FakeTransport();
  await guestTransport.connect(hostId);
  const protocol = new GuestProtocol(guestTransport);
  const welcome = new Promise<{ playerId: string; reconnectToken: string }>((resolve) => {
    protocol.on('welcome', (payload) => resolve(payload));
  });
  protocol.join({ name });
  return { guestTransport, protocol, ...(await welcome) };
}

/** A Host whose every session change is autosaved to `storage`, as `app.tsx` wires it. */
async function autosavingHost(storage: Storage) {
  const hostTransport = new FakeTransport();
  const hostId = await hostTransport.connect();
  const manager = new ConnectionManager(
    hostTransport,
    lobbyRoom(),
    () => {},
    (candidateIds) => candidateIds[0],
    (candidateIds) => candidateIds[0],
    () => {},
    (session) => saveHostSession(storage, session),
  );
  return { manager, hostId };
}

describe('autosaving the Host session', () => {
  it('saves nothing while the Room is still in the Lobby', async () => {
    const storage = new FakeStorage();
    const { hostId } = await autosavingHost(storage);

    await joinGuest(hostId, 'Alex');

    expect(loadHostSession(storage, 'ABCDEF')).toBeNull();
  });

  it('saves the latest Game State after every state-changing action once the game is in progress', async () => {
    const storage = new FakeStorage();
    const { manager, hostId } = await autosavingHost(storage);
    const alex = await joinGuest(hostId, 'Alex');
    manager.room = { ...manager.room, started: true };

    manager.startGame();
    expect(loadHostSession(storage, 'ABCDEF')?.gameState).toEqual(manager.gameState);

    manager.startRound();
    expect(loadHostSession(storage, 'ABCDEF')?.gameState.round).toEqual(expect.objectContaining({ activePlayerId: 'host-1' }));

    alex.protocol.placeBet({ amount: 10, prediction: 'YES' });
    expect(loadHostSession(storage, 'ABCDEF')?.gameState.round?.bets).toEqual([{ playerId: alex.playerId }]);

    manager.resolveRound('NO');
    const saved = loadHostSession(storage, 'ABCDEF');
    expect(saved?.gameState).toEqual(manager.gameState);
    expect(saved?.gameState.players).toEqual([
      expect.objectContaining({ playerId: 'host-1', points: 100 }),
      expect.objectContaining({ playerId: alex.playerId, points: 90 }),
    ]);
    expect(saved?.room).toEqual(expect.objectContaining({ code: 'ABCDEF', started: true }));
  });
});

/** Plays the game up to a resolved Round 1 with Alex's Bet lost, then "reloads" the Host. */
async function hostReloadedMidGame() {
  const storage = new FakeStorage();
  const { manager, hostId } = await autosavingHost(storage);
  const alex = await joinGuest(hostId, 'Alex');
  manager.room = { ...manager.room, started: true };
  manager.startGame();
  manager.startRound();
  alex.protocol.placeBet({ amount: 10, prediction: 'YES' });
  manager.resolveRound('NO');
  const gameStateBeforeReload = manager.gameState;

  const session = loadHostSession(storage, 'ABCDEF');
  if (!session) throw new Error('expected a saved session');
  const resumedTransport = new FakeTransport();
  const resumedHostId = await resumedTransport.connect();
  const resumed = new ConnectionManager(
    resumedTransport,
    session.room,
    () => {},
    (candidateIds) => candidateIds[0],
    (candidateIds) => candidateIds[0],
    () => {},
    (next) => saveHostSession(storage, next),
  );
  resumed.resume(session);

  return { resumed, resumedHostId, alex, gameStateBeforeReload };
}

describe('resuming a saved Host session', () => {
  it('restores the full Game State and the original Room Code', async () => {
    const { resumed, gameStateBeforeReload } = await hostReloadedMidGame();

    expect(resumed.room).toEqual(expect.objectContaining({ code: 'ABCDEF', started: true }));
    expect(resumed.gameState).toEqual(gameStateBeforeReload);
  });

  it("lets a returning Guest rejoin as themselves and see their own Points restored", async () => {
    const { resumedHostId, alex } = await hostReloadedMidGame();

    const guestTransport = new FakeTransport();
    await guestTransport.connect(resumedHostId);
    const received: unknown[] = [];
    guestTransport.onMessage((message) => received.push(message));
    guestTransport.send({ type: 'rejoin', payload: { reconnectToken: alex.reconnectToken } });

    expect(received).toEqual([
      { type: 'welcome', seq: expect.any(Number), payload: { playerId: alex.playerId, reconnectToken: alex.reconnectToken } },
      {
        type: 'state',
        seq: expect.any(Number),
        payload: expect.objectContaining({
          status: 'active',
          players: expect.arrayContaining([
            expect.objectContaining({ playerId: alex.playerId, points: 90, status: 'active', connected: true }),
          ]),
        }),
      },
    ]);
  });

  it('keeps the game going from where it left off — the next Round is already open for Bets', async () => {
    const { resumed, resumedHostId, alex } = await hostReloadedMidGame();
    const guestTransport = new FakeTransport();
    await guestTransport.connect(resumedHostId);
    const protocol = new GuestProtocol(guestTransport);
    protocol.rejoin({ reconnectToken: alex.reconnectToken });

    expect(resumed.gameState?.round?.activePlayerId).toBe(alex.playerId);
    resumed.placeBet('host-1', 5, 'NO');

    expect(resumed.gameState?.round?.bets).toEqual([{ playerId: 'host-1' }]);
  });
});
