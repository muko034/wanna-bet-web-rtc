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

    expect(received).toEqual([{ type: 'rejected', payload: { reason: 'ROOM_FULL', action: 'join' } }]);
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
});
