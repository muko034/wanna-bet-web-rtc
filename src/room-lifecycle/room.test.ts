import { describe, expect, it } from 'vitest';
import { FakeTransport } from '../transport/fake-transport';
import { createRoom, MAX_ROOM_PLAYERS } from './room';

describe('createRoom', () => {
  it('becomes the Host of a new Room, with a shareable id and no connected players yet', async () => {
    const transport = new FakeTransport();

    const room = await createRoom(transport);

    expect(room.roomId).toEqual(expect.any(String));
    expect(room.players).toEqual([]);
  });

  it('counts the Host toward the Room\'s total player count from the moment it is created', async () => {
    const room = await createRoom(new FakeTransport());

    expect(room.playerCount).toBe(1);
    expect(MAX_ROOM_PLAYERS).toBe(20);
  });
});
