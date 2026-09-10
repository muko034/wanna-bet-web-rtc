import { describe, expect, it } from 'vitest';
import { FakeTransport } from '../transport/fake-transport';
import { createRoom, MAX_ROOM_PLAYERS } from './room';
import { RoomRegistry } from './room-registry';

describe('createRoom', () => {
  it('becomes the Host of a new Room, with a shareable Room Code and no connected players yet', async () => {
    const room = await createRoom(new FakeTransport(), new RoomRegistry());

    expect(room.code).toEqual(expect.any(String));
    expect(room.players).toEqual([]);
  });

  it('generates a Room Code distinct from the underlying Transport ID, via the Room Registry', async () => {
    const registry = new RoomRegistry();

    const room = await createRoom(new FakeTransport(), registry);
    const transportId = registry.resolve(room.code);

    expect(transportId).toEqual(expect.any(String));
    expect(transportId).not.toBe(room.code);
  });

  it('counts the Host toward the Room\'s total player count from the moment it is created', async () => {
    const room = await createRoom(new FakeTransport(), new RoomRegistry());

    expect(room.playerCount).toBe(1);
    expect(MAX_ROOM_PLAYERS).toBe(20);
  });

  it('has not started yet', async () => {
    const room = await createRoom(new FakeTransport(), new RoomRegistry());

    expect(room.started).toBe(false);
  });
});
