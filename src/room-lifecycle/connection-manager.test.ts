import { describe, expect, it } from 'vitest';
import { FakeTransport } from '../transport/fake-transport';
import { ConnectionManager } from './connection-manager';
import { MAX_ROOM_PLAYERS, type Room } from './room';

function roomWith(players: Room['players']): Room {
  return { code: 'ABCDEF', players, playerCount: 1 + players.length, started: false };
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
        seq: 0,
        payload: { playerId: expect.any(String), reconnectToken: expect.any(String) },
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

    expect(received).toEqual([{ type: 'rejected', seq: 0, payload: { reason: 'ROOM_FULL', action: 'join' } }]);
    expect(manager.room.players).toHaveLength(MAX_ROOM_PLAYERS - 1);
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

    expect(received).toEqual([{ type: 'welcome', seq: 1, payload: { playerId, reconnectToken } }]);
    expect(manager.room.players).toEqual([expect.objectContaining({ playerId, name: 'Alex', connected: true })]);
    expect(rooms.at(-1)).toEqual(manager.room);

    const strangerGuest = await connectGuest(hostId);
    const strangerReceived: unknown[] = [];
    strangerGuest.onMessage((message) => strangerReceived.push(message));
    strangerGuest.send({ type: 'rejoin', payload: { reconnectToken: 'not-a-real-token' } });

    expect(strangerReceived).toEqual([{ type: 'rejected', seq: 2, payload: { reason: 'UNKNOWN_PLAYER', action: 'rejoin' } }]);
    expect(manager.room.players).toHaveLength(1);
  });
});
