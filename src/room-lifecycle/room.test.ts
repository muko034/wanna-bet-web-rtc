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

  it("derives the Room Code's Transport ID deterministically, so any device can resolve it without a shared lookup", async () => {
    const registry = new RoomRegistry();

    const room = await createRoom(new FakeTransport(), registry);

    expect(registry.transportIdFor(room.code)).toEqual(expect.any(String));
    expect(registry.transportIdFor(room.code)).not.toBe(room.code);
  });

  it('retries with a fresh Room Code when the derived Transport ID is already taken', async () => {
    const codes = ['AAAAAA', 'BBBBBB'];
    const registry = new RoomRegistry(() => codes.shift() ?? 'FALLBACK');
    const collidingHost = new FakeTransport();
    await collidingHost.connect(undefined, registry.transportIdFor('AAAAAA'));

    const room = await createRoom(new FakeTransport(), registry);

    expect(room.code).toBe('BBBBBB');
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
