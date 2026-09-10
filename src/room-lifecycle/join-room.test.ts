import { describe, expect, it, vi } from 'vitest';
import { FakeTransport } from '../transport/fake-transport';
import { RoomRegistry } from './room-registry';
import { ConnectionManager } from './connection-manager';
import { joinRoom } from './join-room';
import type { Room } from './room';

function roomWith(players: Room['players']): Room {
  return { code: 'ABCDEF', players, playerCount: 1 + players.length, started: false };
}

async function hostRoom(registry: RoomRegistry, room: Room = roomWith([])) {
  const hostTransport = new FakeTransport();
  const code = registry.generate();
  await hostTransport.connect(undefined, registry.transportIdFor(code));
  new ConnectionManager(hostTransport, room, () => {});
  return code;
}

describe('joinRoom', () => {
  it("connects to the Host and resolves with this Guest's assigned playerId", async () => {
    const registry = new RoomRegistry();
    const code = await hostRoom(registry);

    const result = await joinRoom(new FakeTransport(), registry, code, 'Alex');

    expect(result).toEqual({ status: 'joined', playerId: expect.any(String), reconnectToken: expect.any(String) });
  });

  it('resolves with a clear error for a Room Code no Host is reachable under', async () => {
    const registry = new RoomRegistry();

    const result = await joinRoom(new FakeTransport(), registry, 'NOPE12', 'Alex');

    expect(result).toEqual({ status: 'invalid-room' });
  });

  it('resolves with a clear error when the Host is unreachable for a reason other than not existing', async () => {
    const registry = new RoomRegistry();
    const code = registry.generate();
    const transport = new FakeTransport();
    vi.spyOn(transport, 'connect').mockRejectedValue(new Error('network error'));

    const result = await joinRoom(transport, registry, code, 'Alex');

    expect(result.status).toBe('unreachable');
  });

  it('resolves with a "Room is full" error and does not connect, when the Room is already at capacity', async () => {
    const registry = new RoomRegistry();
    const fullRoomPlayers = Array.from({ length: 19 }, (_, i) => ({
      playerId: `p${i}`,
      name: `Player ${i}`,
      connected: true,
    }));
    const code = await hostRoom(registry, roomWith(fullRoomPlayers));

    const result = await joinRoom(new FakeTransport(), registry, code, 'Overflow');

    expect(result).toEqual({ status: 'room-full' });
  });
});
