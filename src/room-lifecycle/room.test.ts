import { describe, expect, it } from 'vitest';
import { FakeTransport } from '../transport/fake-transport';
import { RequestedIdTakenError, type Transport } from '../transport/transport';
import { createRoom, MAX_ROOM_PLAYERS, reopenRoom, type Room } from './room';
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
  function room(): Room {
    return { code: 'ABCDEF', hostName: 'Host', hostPlayerId: 'host-1', players: [], playerCount: 1, started: true };
  }

  it("makes a resumed Room reachable again under its original Room Code's Transport ID", async () => {
    const registry = new RoomRegistry();

    await reopenRoom(new FakeTransport(), registry, room());

    const guest = new FakeTransport();
    await expect(guest.connect(registry.transportIdFor('ABCDEF'))).resolves.toEqual(expect.any(String));
  });

  /** A Transport whose first `failures` connects fail with `error`, e.g. while the previous tab still holds the id. */
  function transportFailingFirst(failures: number, error: () => Error = () => new RequestedIdTakenError('taken')) {
    let attempts = 0;
    const transport: Transport = {
      connect: async () => {
        attempts++;
        if (attempts <= failures) throw error();
        return 'reclaimed-id';
      },
      send: () => {},
      onMessage: () => {},
      onConnectionChange: () => {},
    };
    return { transport, attempts: () => attempts };
  }

  it("keeps retrying every 3 seconds while the Host's previous tab still holds the Room's Transport ID", async () => {
    const { transport, attempts } = transportFailingFirst(2);
    const waits: number[] = [];

    await reopenRoom(transport, new RoomRegistry(), room(), async (ms) => void waits.push(ms));

    expect(attempts()).toBe(3);
    expect(waits).toEqual([3000, 3000]);
  });

  it('gives up with RequestedIdTakenError after about a minute of retries', async () => {
    const { transport, attempts } = transportFailingFirst(Infinity);
    let waited = 0;

    await expect(reopenRoom(transport, new RoomRegistry(), room(), async (ms) => void (waited += ms))).rejects.toBeInstanceOf(
      RequestedIdTakenError,
    );
    expect(waited).toBe(60_000);
    expect(attempts()).toBe(21);
  });

  it('fails straight away, without retrying, on any other error', async () => {
    const unreachable = new Error('server unreachable');
    const { transport, attempts } = transportFailingFirst(Infinity, () => unreachable);

    await expect(reopenRoom(transport, new RoomRegistry(), room(), async () => {})).rejects.toBe(unreachable);
    expect(attempts()).toBe(1);
  });
});
