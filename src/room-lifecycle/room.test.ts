import { describe, expect, it } from 'vitest';
import { FakeTransport } from '../transport/fake-transport';
import { createRoom, MAX_ROOM_PLAYERS, reopenRoom } from './room';
import { RoomRegistry } from './room-registry';

describe('createRoom', () => {
  it('becomes the Host of a new Room, with a shareable Room Code and no connected players yet', async () => {
    const room = await createRoom(new FakeTransport(), new RoomRegistry(), 'TestHost');

    expect(room.code).toEqual(expect.any(String));
    expect(room.players).toEqual([]);
  });

  it("derives the Room Code's Transport ID deterministically, so any device can resolve it without a shared lookup", async () => {
    const registry = new RoomRegistry();

    const room = await createRoom(new FakeTransport(), registry, 'TestHost');

    expect(registry.transportIdFor(room.code)).toEqual(expect.any(String));
    expect(registry.transportIdFor(room.code)).not.toBe(room.code);
  });

  it('retries with a fresh Room Code when the derived Transport ID is already taken', async () => {
    const codes = ['AAAAAA', 'BBBBBB'];
    const registry = new RoomRegistry(() => codes.shift() ?? 'FALLBACK');
    const collidingHost = new FakeTransport();
    await collidingHost.connect(undefined, registry.transportIdFor('AAAAAA'));

    const room = await createRoom(new FakeTransport(), registry, 'TestHost');

    expect(room.code).toBe('BBBBBB');
  });

  it('counts the Host toward the Room\'s total player count from the moment it is created', async () => {
    const room = await createRoom(new FakeTransport(), new RoomRegistry(), 'TestHost');

    expect(room.playerCount).toBe(1);
    expect(MAX_ROOM_PLAYERS).toBe(20);
  });

  it('has not started yet', async () => {
    const room = await createRoom(new FakeTransport(), new RoomRegistry(), 'TestHost');

    expect(room.started).toBe(false);
  });

  it("records the Host's own display name and a fresh playerId, distinct from any Guest's", async () => {
    const room = await createRoom(new FakeTransport(), new RoomRegistry(), 'Alex');

    expect(room.hostName).toBe('Alex');
    expect(room.hostPlayerId).toEqual(expect.any(String));
  });
});

describe('reopenRoom', () => {
  it("makes a resumed Room reachable again under its original Room Code's Transport ID", async () => {
    const registry = new RoomRegistry();
    const room = { code: 'ABCDEF', hostName: 'Host', hostPlayerId: 'host-1', players: [], playerCount: 1, started: true };

    await reopenRoom(new FakeTransport(), registry, room);

    const guest = new FakeTransport();
    await expect(guest.connect(registry.transportIdFor('ABCDEF'))).resolves.toEqual(expect.any(String));
  });
});
