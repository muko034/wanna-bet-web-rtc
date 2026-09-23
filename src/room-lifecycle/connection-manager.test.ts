import { describe, expect, it } from 'vitest';
import { FakeTransport } from '../transport/fake-transport';
import { ConnectionManager } from './connection-manager';
import { MAX_ROOM_PLAYERS, type Room } from './room';

function roomWith(players: Room['players'], overrides: Partial<Room> = {}): Room {
  return { code: 'ABCDEF', hostName: 'Host', hostPlayerId: 'host-1', players, playerCount: 1 + players.length, started: false, ...overrides };
}

async function connectGuest(hostId: string) {
  const guestTransport = new FakeTransport();
  await guestTransport.connect(hostId);
  return guestTransport;
}

type WelcomePayload = { playerId: string; reconnectToken: string };

/** Joins as a fresh Guest and returns the `welcome` payload the Host replied with. */
async function joinAndAwaitWelcome(hostId: string, name: string): Promise<WelcomePayload> {
  const guestTransport = await connectGuest(hostId);
  const welcome = new Promise<WelcomePayload>((resolve) => {
    guestTransport.onMessage((message) => {
      if ((message as { type?: unknown }).type === 'welcome') {
        resolve((message as { payload: WelcomePayload }).payload);
      }
    });
  });
  guestTransport.send({ type: 'join', payload: { name } });
  return welcome;
}

describe('Lobby snapshots', () => {
  it('builds a Lobby GameState — the Host alone — as soon as the Room exists, before any Guest joins', async () => {
    const hostTransport = new FakeTransport();
    await hostTransport.connect();
    const manager = new ConnectionManager(hostTransport, roomWith([]), () => {});

    expect(manager.gameState).toEqual({
      roomId: 'ABCDEF',
      status: 'lobby',
      activePlayerId: null,
      resolution: null,
      round: null,
      players: [expect.objectContaining({ playerId: 'host-1', name: 'Host' })],
    });
  });

  it('does not build a Lobby GameState for a Room resumed already started', async () => {
    const hostTransport = new FakeTransport();
    await hostTransport.connect();
    const manager = new ConnectionManager(hostTransport, roomWith([], { started: true }), () => {});

    expect(manager.gameState).toBeNull();
  });

  it('broadcasts a fresh Lobby snapshot — reaching a newly joined Guest too — after a join', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    const manager = new ConnectionManager(hostTransport, roomWith([]), () => {});

    const guestTransport = await connectGuest(hostId);
    const received: unknown[] = [];
    guestTransport.onMessage((message) => received.push(message));
    guestTransport.send({ type: 'join', payload: { name: 'Alex' } });

    const lobbySnapshots = received.filter((m) => (m as { type?: unknown }).type === 'state');
    expect(lobbySnapshots).toEqual([
      {
        type: 'state',
        seq: expect.any(Number),
        payload: expect.objectContaining({
          status: 'lobby',
          players: [
            expect.objectContaining({ playerId: 'host-1', name: 'Host' }),
            expect.objectContaining({ name: 'Alex' }),
          ],
        }),
      },
    ]);
    expect(manager.gameState?.status).toBe('lobby');
  });

  it('broadcasts a fresh Lobby snapshot — reaching a rejoining Guest too — after a rejoin', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    new ConnectionManager(hostTransport, roomWith([]), () => {});
    const { reconnectToken } = await joinAndAwaitWelcome(hostId, 'Alex');

    const rejoiningGuest = await connectGuest(hostId);
    const received: unknown[] = [];
    rejoiningGuest.onMessage((message) => received.push(message));
    rejoiningGuest.send({ type: 'rejoin', payload: { reconnectToken } });

    const lobbySnapshots = received.filter((m) => (m as { type?: unknown }).type === 'state');
    expect(lobbySnapshots).toHaveLength(1);
    expect((lobbySnapshots[0] as { payload: { status: string } }).payload.status).toBe('lobby');
  });

  it('does not broadcast a Lobby snapshot on a rejoin once the Game has started', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    const manager = new ConnectionManager(hostTransport, roomWith([]), () => {});
    const { reconnectToken } = await joinAndAwaitWelcome(hostId, 'Alex');
    manager.room = { ...manager.room, started: true };
    manager.gameState = { roomId: 'ABCDEF', status: 'active', activePlayerId: null, resolution: null, round: null, players: [] };

    const rejoiningGuest = await connectGuest(hostId);
    const received: unknown[] = [];
    rejoiningGuest.onMessage((message) => received.push(message));
    rejoiningGuest.send({ type: 'rejoin', payload: { reconnectToken } });

    expect(received).toEqual([{ type: 'welcome', seq: expect.any(Number), payload: expect.anything() }]);
  });

  it('broadcasts a fresh Lobby snapshot, without the Guest, after that Guest leaves', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    const manager = new ConnectionManager(hostTransport, roomWith([]), () => {});
    await joinAndAwaitWelcome(hostId, 'Alex');
    const secondGuest = await connectGuest(hostId);
    const { playerId: samId } = await (async () => {
      const welcome = new Promise<WelcomePayload>((resolve) => {
        secondGuest.onMessage((message) => {
          if ((message as { type?: unknown }).type === 'welcome') {
            resolve((message as { payload: WelcomePayload }).payload);
          }
        });
      });
      secondGuest.send({ type: 'join', payload: { name: 'Sam' } });
      return welcome;
    })();

    secondGuest.send({ type: 'leave', payload: {} });

    expect(manager.room.players.map((p) => p.playerId)).not.toContain(samId);
    expect(manager.gameState?.players.map((p) => p.playerId)).not.toContain(samId);
    expect(manager.gameState?.status).toBe('lobby');
  });

  it('broadcasts a fresh Lobby snapshot after a Guest disconnects, before the Game has started', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    const manager = new ConnectionManager(hostTransport, roomWith([]), () => {});
    const guestTransport = await connectGuest(hostId);
    guestTransport.send({ type: 'join', payload: { name: 'Alex' } });

    guestTransport.disconnect();

    expect(manager.gameState?.status).toBe('lobby');
    expect(manager.gameState?.players).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Alex', connected: false })]),
    );
  });

  it('does not overwrite the in-progress Game with a Lobby snapshot when a Guest disconnects mid-game', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    const manager = new ConnectionManager(hostTransport, roomWith([]), () => {});
    const guestTransport = await connectGuest(hostId);
    guestTransport.send({ type: 'join', payload: { name: 'Alex' } });
    manager.room = { ...manager.room, started: true };
    manager.startGame();

    guestTransport.disconnect();

    expect(manager.gameState?.status).toBe('active');
  });
});

describe('ConnectionManager', () => {
  it("adds a Guest to the Room once it sends a join message, and notifies of the Room's new state", async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    const rooms: Room[] = [];
    const manager = new ConnectionManager(hostTransport, roomWith([]), (room) => rooms.push(room));

    const guestTransport = await connectGuest(hostId);
    guestTransport.send({ type: 'join', payload: { name: 'Alex' } });

    expect(manager.room.players).toEqual([expect.objectContaining({ name: 'Alex', connected: true })]);
    expect(rooms.at(-1)).toEqual(manager.room);
  });

  it('marks a Guest as disconnected once their connection drops, and notifies of the Room\'s new state', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    const rooms: Room[] = [];
    const manager = new ConnectionManager(hostTransport, roomWith([]), (room) => rooms.push(room));

    const guestTransport = await connectGuest(hostId);
    guestTransport.send({ type: 'join', payload: { name: 'Alex' } });
    guestTransport.disconnect();

    expect(manager.room.players).toEqual([expect.objectContaining({ name: 'Alex', connected: false })]);
    expect(rooms.at(-1)).toEqual(manager.room);
  });

  it('sends a welcome message, addressed only to the joining Guest, with a fresh playerId and reconnectToken', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    new ConnectionManager(hostTransport, roomWith([]), () => {});

    const guestTransport = await connectGuest(hostId);
    const received: unknown[] = [];
    guestTransport.onMessage((message) => received.push(message));
    guestTransport.send({ type: 'join', payload: { name: 'Alex' } });

    expect(received).toEqual([
      {
        type: 'welcome',
        seq: expect.any(Number),
        payload: { playerId: expect.any(String), reconnectToken: expect.any(String) },
      },
      {
        type: 'state',
        seq: expect.any(Number),
        payload: expect.objectContaining({ status: 'lobby' }),
      },
    ]);
  });

  it('rejects a join once the Room is already at capacity, and does not add the Guest', async () => {
    const existingPlayers = Array.from({ length: MAX_ROOM_PLAYERS - 1 }, (_, i) => ({
      playerId: `p${i}`,
      name: `Player ${i}`,
      connected: true,
    }));
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    const manager = new ConnectionManager(hostTransport, roomWith(existingPlayers), () => {});

    const guestTransport = await connectGuest(hostId);
    const received: unknown[] = [];
    guestTransport.onMessage((message) => received.push(message));
    guestTransport.send({ type: 'join', payload: { name: 'Overflow' } });

    expect(received).toEqual([{ type: 'rejected', seq: expect.any(Number), payload: { reason: 'ROOM_FULL', action: 'join' } }]);
    expect(manager.room.players).toHaveLength(MAX_ROOM_PLAYERS - 1);
  });

  it('rejects a fresh join once the Game has started, and does not add the Guest', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    const manager = new ConnectionManager(hostTransport, roomWith([], { started: true }), () => {});

    const guestTransport = await connectGuest(hostId);
    const received: unknown[] = [];
    guestTransport.onMessage((message) => received.push(message));
    guestTransport.send({ type: 'join', payload: { name: 'Latecomer' } });

    expect(received).toEqual([{ type: 'rejected', seq: 0, payload: { reason: 'GAME_STARTED', action: 'join' } }]);
    expect(manager.room.players).toHaveLength(0);
  });

  it('still allows a previously-joined Guest to rejoin after the Game has started', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    const manager = new ConnectionManager(hostTransport, roomWith([]), () => {});
    const { playerId, reconnectToken } = await joinAndAwaitWelcome(hostId, 'Alex');

    manager.room = { ...manager.room, started: true };

    const rejoiningGuest = await connectGuest(hostId);
    const received: unknown[] = [];
    rejoiningGuest.onMessage((message) => received.push(message));
    rejoiningGuest.send({ type: 'rejoin', payload: { reconnectToken } });

    expect(received).toEqual([{ type: 'welcome', seq: expect.any(Number), payload: { playerId, reconnectToken } }]);
    expect(manager.room.players).toEqual([expect.objectContaining({ playerId, name: 'Alex', connected: true })]);
  });

  it('disambiguates a joining Guest\'s display name when it collides with one already connected', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    const manager = new ConnectionManager(hostTransport, roomWith([]), () => {});

    const guestA = await connectGuest(hostId);
    guestA.send({ type: 'join', payload: { name: 'Alex' } });
    const guestB = await connectGuest(hostId);
    guestB.send({ type: 'join', payload: { name: 'Alex' } });

    expect(manager.room.players.map((p) => p.name)).toEqual(['Alex', 'Alex (2)']);
    expect(manager.room.players[0].playerId).not.toBe(manager.room.players[1].playerId);
  });

  it("matches a rejoining Guest back to their existing player record by their reconnectToken, without creating a duplicate, and rejects an unrecognized token", async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    const rooms: Room[] = [];
    const manager = new ConnectionManager(hostTransport, roomWith([]), (room) => rooms.push(room));
    const { playerId, reconnectToken } = await joinAndAwaitWelcome(hostId, 'Alex');

    const rejoiningGuest = await connectGuest(hostId);
    const received: unknown[] = [];
    rejoiningGuest.onMessage((message) => received.push(message));
    rejoiningGuest.send({ type: 'rejoin', payload: { reconnectToken } });

    expect(received).toEqual([
      { type: 'welcome', seq: expect.any(Number), payload: { playerId, reconnectToken } },
      { type: 'state', seq: expect.any(Number), payload: expect.objectContaining({ status: 'lobby' }) },
    ]);
    expect(manager.room.players).toEqual([expect.objectContaining({ playerId, name: 'Alex', connected: true })]);
    expect(rooms.at(-1)).toEqual(manager.room);

    const strangerGuest = await connectGuest(hostId);
    const strangerReceived: unknown[] = [];
    strangerGuest.onMessage((message) => strangerReceived.push(message));
    strangerGuest.send({ type: 'rejoin', payload: { reconnectToken: 'not-a-real-token' } });

    expect(strangerReceived).toEqual([{ type: 'rejected', seq: expect.any(Number), payload: { reason: 'UNKNOWN_PLAYER', action: 'rejoin' } }]);
    expect(manager.room.players).toHaveLength(1);
  });

  it("broadcasts the initial GameState — the Host included alongside every Guest — once the game starts", async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    const manager = new ConnectionManager(hostTransport, roomWith([]), () => {});
    const { playerId } = await joinAndAwaitWelcome(hostId, 'Alex');
    const guestTransport = await connectGuest(hostId);
    const received: unknown[] = [];
    guestTransport.onMessage((message) => received.push(message));

    manager.startGame();

    expect(received).toEqual([
      {
        type: 'state',
        seq: expect.any(Number),
        payload: {
          roomId: 'ABCDEF',
          status: 'active',
          activePlayerId: null,
          resolution: null,
          round: null,
          players: [
            expect.objectContaining({ playerId: 'host-1', name: 'Host' }),
            expect.objectContaining({ playerId, name: 'Alex' }),
          ],
        },
      },
    ]);
  });
});

describe('choosing the Active Player', () => {
  it('picks the first Round\'s Active Player at random from every Player, the Host included, in join order', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    const receivedCandidates: string[][] = [];
    const manager = new ConnectionManager(
      hostTransport,
      roomWith([]),
      () => {},
      (candidateIds) => candidateIds[0],
      (candidateIds) => {
        receivedCandidates.push(candidateIds);
        return candidateIds[0];
      },
    );
    const { playerId: alexId } = await joinAndAwaitWelcome(hostId, 'Alex');
    const { playerId: samId } = await joinAndAwaitWelcome(hostId, 'Sam');

    manager.startGame();
    manager.startRound();

    expect(receivedCandidates).toEqual([['host-1', alexId, samId]]);
  });

  it('does not re-randomize the Active Player for later Rounds — it follows the fixed order the first pick established', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    let pickCount = 0;
    const manager = new ConnectionManager(
      hostTransport,
      roomWith([]),
      () => {},
      (candidateIds) => candidateIds[0],
      (candidateIds) => {
        pickCount++;
        return candidateIds[0];
      },
    );
    await joinAndAwaitWelcome(hostId, 'Alex');

    manager.startGame();
    manager.startRound();
    manager.startRound();

    expect(pickCount).toBe(1);
  });
});
