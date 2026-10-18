import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeTransport } from '../transport/fake-transport';
import { RoomRegistry } from './room-registry';
import { ConnectionManager } from './connection-manager';
import { HOST_SILENCE_TIMEOUT_MS, joinRoom, rejoinRoom, watchForBetRejection, watchForConnectionDrop, watchForGameStart, watchForHostSilence, watchGameState } from './join-room';
import type { GameState } from '../protocol/messages';
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

  describe('on a started Game', () => {
    afterEach(() => vi.useRealTimers());

    async function startedHost(registry: RoomRegistry) {
      const hostTransport = new FakeTransport();
      const code = registry.generate();
      await hostTransport.connect(undefined, registry.transportIdFor(code));
      const manager = new ConnectionManager(hostTransport, roomWith([]), () => {});
      manager.room = { ...manager.room, started: true };
      manager.startGame();
      manager.startRound();
      return { code, manager };
    }

    it('waits for the Host to answer, with no reply timeout, and resolves joined once the Host admits', async () => {
      vi.useFakeTimers();
      const registry = new RoomRegistry();
      const { code, manager } = await startedHost(registry);
      let result: Awaited<ReturnType<typeof joinRoom>> | undefined;
      joinRoom(new FakeTransport(), registry, code, 'Latecomer').then((r) => (result = r));

      await vi.advanceTimersByTimeAsync(60_000);
      expect(result).toBeUndefined();
      manager.admitJoinRequest(100);
      await vi.advanceTimersByTimeAsync(0);

      expect(result).toEqual({ status: 'joined', playerId: expect.any(String), reconnectToken: expect.any(String) });
    });

    it('resolves "join-declined" when the Host declines', async () => {
      const registry = new RoomRegistry();
      const { code, manager } = await startedHost(registry);
      const result = joinRoom(new FakeTransport(), registry, code, 'Latecomer');
      await vi.waitFor(() => expect(manager.joinRequests).toHaveLength(1));

      manager.declineJoinRequest();

      expect(await result).toEqual({ status: 'join-declined' });
    });

    it('resolves "room-full" when the Room is full at request time', async () => {
      const registry = new RoomRegistry();
      const hostTransport = new FakeTransport();
      const code = registry.generate();
      await hostTransport.connect(undefined, registry.transportIdFor(code));
      const guests = Array.from({ length: 19 }, (_, i) => ({ playerId: `p${i}`, name: `Player ${i}`, connected: true }));
      const manager = new ConnectionManager(hostTransport, roomWith(guests), () => {});
      manager.room = { ...manager.room, started: true };
      manager.startGame();
      manager.startRound();

      expect(await joinRoom(new FakeTransport(), registry, code, 'Overflow')).toEqual({ status: 'room-full' });
    });

    it('tells the caller once the request is sent, and not before the connection opened', async () => {
      const registry = new RoomRegistry();
      const { code, manager } = await startedHost(registry);
      const onRequestSent = vi.fn();

      const result = joinRoom(new FakeTransport(), registry, code, 'Latecomer', undefined, { onSent: onRequestSent });
      expect(onRequestSent).not.toHaveBeenCalled();
      await vi.waitFor(() => expect(onRequestSent).toHaveBeenCalledTimes(1));
      manager.admitJoinRequest(100);

      expect((await result).status).toBe('joined');
    });

    it('still gives up on the connection after the connect timeout when the Host never opens it', async () => {
      const registry = new RoomRegistry();
      const transport = new FakeTransport();
      vi.spyOn(transport, 'connect').mockReturnValue(new Promise(() => {}));

      expect(await joinRoom(transport, registry, registry.generate(), 'Latecomer', async () => 'timed-out')).toEqual({ status: 'unreachable' });
    });
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

describe('watchForBetRejection', () => {
  async function connectedPair() {
    const registry = new RoomRegistry();
    const hostTransport = new FakeTransport();
    const code = registry.generate();
    await hostTransport.connect(undefined, registry.transportIdFor(code));
    const guestTransport = new FakeTransport();
    await guestTransport.connect(registry.transportIdFor(code));
    return { hostTransport, guestTransport };
  }

  const rejected = (reason: string, action: string) => ({ type: 'rejected' as const, seq: 1, payload: { reason, action } });

  it('reports the reason when the Host refuses a placeBet', async () => {
    const { hostTransport, guestTransport } = await connectedPair();
    const onBetRejected = vi.fn();
    watchForBetRejection(guestTransport, onBetRejected);

    hostTransport.send(rejected('INVALID_BET_AMOUNT', 'placeBet'));

    expect(onBetRejected).toHaveBeenCalledExactlyOnceWith('INVALID_BET_AMOUNT');
  });

  it('ignores rejections of other actions and reasons this build does not know', async () => {
    const { hostTransport, guestTransport } = await connectedPair();
    const onBetRejected = vi.fn();
    watchForBetRejection(guestTransport, onBetRejected);

    hostTransport.send(rejected('ROOM_FULL', 'join'));
    hostTransport.send(rejected('SOMETHING_NEW', 'placeBet'));

    expect(onBetRejected).not.toHaveBeenCalled();
  });
});

describe('Host heartbeat on the Guest side', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const snapshot: GameState = { roomId: 'ABCDEF', status: 'active', challengerId: null, players: [], round: null, resolution: null };
  let seq = 0;
  const stateMessage = (epoch: string, version: number, overrides: Partial<GameState> = {}) => ({
    type: 'state' as const,
    seq: seq++,
    payload: { epoch, version, snapshot: { ...snapshot, ...overrides } },
  });

  async function connectedPair() {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    const guestTransport = new FakeTransport();
    await guestTransport.connect(hostId);
    return { hostTransport, guestTransport };
  }

  describe('watchGameState', () => {
    it('skips a state whose epoch and version both match the last one seen', async () => {
      const { hostTransport, guestTransport } = await connectedPair();
      const onGameState = vi.fn();
      watchGameState(guestTransport, onGameState);

      hostTransport.send(stateMessage('e1', 0));
      hostTransport.send(stateMessage('e1', 0));
      hostTransport.send(stateMessage('e1', 0));

      expect(onGameState).toHaveBeenCalledTimes(1);
    });

    it('applies a state with a new version, and a lower version is not dropped', async () => {
      const { hostTransport, guestTransport } = await connectedPair();
      const onGameState = vi.fn();
      watchGameState(guestTransport, onGameState);

      hostTransport.send(stateMessage('e1', 5));
      hostTransport.send(stateMessage('e1', 6, { status: 'ended' }));
      hostTransport.send(stateMessage('e1', 2, { status: 'lobby' }));

      expect(onGameState.mock.calls.map(([state]) => state.status)).toEqual(['active', 'ended', 'lobby']);
    });

    it('applies a restarted Host\'s state even when its version equals the old one', async () => {
      const { hostTransport, guestTransport } = await connectedPair();
      const onGameState = vi.fn();
      watchGameState(guestTransport, onGameState);

      hostTransport.send(stateMessage('e1', 0));
      hostTransport.send(stateMessage('e2', 0, { status: 'lobby' }));

      expect(onGameState).toHaveBeenCalledTimes(2);
      expect(onGameState).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'lobby' }));
    });
  });

  describe('watchForHostSilence', () => {
    it('reports the Host silent after 9 s without any state', async () => {
      const { hostTransport, guestTransport } = await connectedPair();
      const onSilent = vi.fn();
      watchForHostSilence(guestTransport, onSilent);
      hostTransport.send(stateMessage('e1', 0));

      vi.advanceTimersByTime(HOST_SILENCE_TIMEOUT_MS - 1);
      expect(onSilent).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);

      expect(HOST_SILENCE_TIMEOUT_MS).toBe(9_000);
      expect(onSilent).toHaveBeenCalledOnce();
    });

    it('reports the Host silent 9 s after being armed when it never sends any state at all', async () => {
      const { guestTransport } = await connectedPair();
      const onSilent = vi.fn();
      const arm = watchForHostSilence(guestTransport, onSilent);
      vi.advanceTimersByTime(HOST_SILENCE_TIMEOUT_MS * 2);
      expect(onSilent).not.toHaveBeenCalled();
      arm();

      vi.advanceTimersByTime(HOST_SILENCE_TIMEOUT_MS - 1);
      expect(onSilent).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);

      expect(onSilent).toHaveBeenCalledOnce();
    });

    it('counts every state as a sign of life, an unchanged heartbeat included', async () => {
      const { hostTransport, guestTransport } = await connectedPair();
      const onSilent = vi.fn();
      watchForHostSilence(guestTransport, onSilent);

      for (let i = 0; i < 10; i++) {
        hostTransport.send(stateMessage('e1', 0));
        vi.advanceTimersByTime(HOST_SILENCE_TIMEOUT_MS - 1_000);
      }

      expect(onSilent).not.toHaveBeenCalled();
    });

    it('reports a silent Host only once, and not at all after the connection was reported dropped', async () => {
      const { hostTransport, guestTransport } = await connectedPair();
      const onSilent = vi.fn();
      watchForHostSilence(guestTransport, onSilent);
      hostTransport.send(stateMessage('e1', 0));
      vi.advanceTimersByTime(HOST_SILENCE_TIMEOUT_MS * 3);
      expect(onSilent).toHaveBeenCalledOnce();

      const second = await connectedPair();
      const onSecondSilent = vi.fn();
      watchForHostSilence(second.guestTransport, onSecondSilent);
      second.hostTransport.send(stateMessage('e1', 0));
      second.hostTransport.disconnect();
      vi.advanceTimersByTime(HOST_SILENCE_TIMEOUT_MS * 3);
      expect(onSecondSilent).not.toHaveBeenCalled();
    });
  });
});
