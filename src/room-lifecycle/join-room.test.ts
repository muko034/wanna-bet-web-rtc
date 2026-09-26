import { describe, expect, it, vi } from 'vitest';
import { FakeTransport } from '../transport/fake-transport';
import { RoomRegistry } from './room-registry';
import { ConnectionManager } from './connection-manager';
import { joinRoom, rejoinRoom, watchForConnectionDrop, watchForGameStart } from './join-room';
import type { Room } from './room';

function roomWith(players: Room['players'], overrides: Partial<Room> = {}): Room {
  return { code: 'ABCDEF', hostName: 'Host', hostPlayerId: 'host-1', players, playerCount: 1 + players.length, started: false, ...overrides };
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

  it('resolves with a clear error when the Host never responds at all (the connect attempt hangs)', async () => {
    const registry = new RoomRegistry();
    const code = registry.generate();
    const transport = new FakeTransport();
    vi.spyOn(transport, 'connect').mockReturnValue(new Promise(() => {})); // never settles

    const result = await joinRoom(transport, registry, code, 'Alex', async () => 'timed-out');

    expect(result).toEqual({ status: 'unreachable' });
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

  it('resolves with a "game already started" error and does not connect, once the Room\'s game has started', async () => {
    const registry = new RoomRegistry();
    const code = await hostRoom(registry, roomWith([], { started: true }));

    const result = await joinRoom(new FakeTransport(), registry, code, 'Latecomer');

    expect(result).toEqual({ status: 'game-started' });
  });
});

describe('rejoinRoom', () => {
  it("reconnects to the Host and resolves with the same playerId, presenting a stored reconnectToken instead of a name", async () => {
    const registry = new RoomRegistry();
    const code = await hostRoom(registry);
    const joined = await joinRoom(new FakeTransport(), registry, code, 'Alex');
    if (joined.status !== 'joined') throw new Error('setup failed');

    const result = await rejoinRoom(new FakeTransport(), registry, code, joined.reconnectToken);

    expect(result).toEqual({ status: 'joined', playerId: joined.playerId, reconnectToken: joined.reconnectToken });
  });

  it('resolves with a clear "not recognized" result when the Host does not recognize the presented reconnectToken', async () => {
    const registry = new RoomRegistry();
    const code = await hostRoom(registry);

    const result = await rejoinRoom(new FakeTransport(), registry, code, 'a-stale-or-foreign-token');

    expect(result).toEqual({ status: 'unknown-player' });
  });

  it('resolves with a clear error for a Room Code no Host is reachable under', async () => {
    const registry = new RoomRegistry();

    const result = await rejoinRoom(new FakeTransport(), registry, 'NOPE12', 'some-token');

    expect(result).toEqual({ status: 'invalid-room' });
  });

  it('resolves with a clear error when the Host never responds at all (the connect attempt hangs)', async () => {
    const registry = new RoomRegistry();
    const code = registry.generate();
    const transport = new FakeTransport();
    vi.spyOn(transport, 'connect').mockReturnValue(new Promise(() => {})); // never settles

    const result = await rejoinRoom(transport, registry, code, 'a-token', async () => 'timed-out');

    expect(result).toEqual({ status: 'unreachable' });
  });
});

describe('watchForConnectionDrop', () => {
  it('notifies the caller when the connection to the Host is lost', async () => {
    const registry = new RoomRegistry();
    const hostTransport = new FakeTransport();
    const code = registry.generate();
    await hostTransport.connect(undefined, registry.transportIdFor(code));
    const guestTransport = new FakeTransport();
    await guestTransport.connect(registry.transportIdFor(code));

    const onConnectionDropped = vi.fn();
    watchForConnectionDrop(guestTransport, onConnectionDropped);
    hostTransport.disconnect();

    expect(onConnectionDropped).toHaveBeenCalledOnce();
  });

  it('does not notify the caller while the connection to the Host is still up', async () => {
    const registry = new RoomRegistry();
    const hostTransport = new FakeTransport();
    const code = registry.generate();
    await hostTransport.connect(undefined, registry.transportIdFor(code));
    const guestTransport = new FakeTransport();
    await guestTransport.connect(registry.transportIdFor(code));

    const onConnectionDropped = vi.fn();
    watchForConnectionDrop(guestTransport, onConnectionDropped);

    expect(onConnectionDropped).not.toHaveBeenCalled();
  });
});

describe('watchForGameStart', () => {
  it('notifies the caller once the Host broadcasts a GameState with status "active"', async () => {
    const registry = new RoomRegistry();
    const hostTransport = new FakeTransport();
    const code = registry.generate();
    await hostTransport.connect(undefined, registry.transportIdFor(code));
    const manager = new ConnectionManager(hostTransport, roomWith([{ playerId: 'p1', name: 'Alex', connected: true }]), () => {});
    const guestTransport = new FakeTransport();
    await guestTransport.connect(registry.transportIdFor(code));

    const onGameStarted = vi.fn();
    watchForGameStart(guestTransport, onGameStarted);
    manager.startGame();

    expect(onGameStarted).toHaveBeenCalledOnce();
  });

  it('does not notify the caller before the Host has broadcast any GameState', async () => {
    const registry = new RoomRegistry();
    const hostTransport = new FakeTransport();
    const code = registry.generate();
    await hostTransport.connect(undefined, registry.transportIdFor(code));
    new ConnectionManager(hostTransport, roomWith([]), () => {});
    const guestTransport = new FakeTransport();
    await guestTransport.connect(registry.transportIdFor(code));

    const onGameStarted = vi.fn();
    watchForGameStart(guestTransport, onGameStarted);

    expect(onGameStarted).not.toHaveBeenCalled();
  });

  it('does not notify the caller for a Lobby snapshot (status "lobby"), only for the first "active" one', async () => {
    const registry = new RoomRegistry();
    const hostTransport = new FakeTransport();
    const code = registry.generate();
    await hostTransport.connect(undefined, registry.transportIdFor(code));
    const manager = new ConnectionManager(hostTransport, roomWith([]), () => {});
    const guestTransport = new FakeTransport();
    await guestTransport.connect(registry.transportIdFor(code));

    const onGameStarted = vi.fn();
    watchForGameStart(guestTransport, onGameStarted);
    guestTransport.send({ type: 'join', payload: { name: 'Alex' } }); // triggers a Lobby snapshot broadcast

    expect(onGameStarted).not.toHaveBeenCalled();

    manager.room = { ...manager.room, started: true };
    manager.startGame();

    expect(onGameStarted).toHaveBeenCalledOnce();
  });
});
