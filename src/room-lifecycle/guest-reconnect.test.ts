import { describe, expect, it, vi } from 'vitest';
import { FakeTransport } from '../transport/fake-transport';
import { FakeStorage } from '../fake-storage';
import { RoomRegistry } from './room-registry';
import { ConnectionManager } from './connection-manager';
import { attemptReconnect, type ReconnectCallbacks } from './guest-reconnect';
import { joinRoom } from './join-room';
import { saveIdentity, loadIdentity } from './player-identity';
import type { Room } from './room';

function roomWith(players: Room['players'], overrides: Partial<Room> = {}): Room {
  return { code: 'ABCDEF', hostName: 'Host', hostPlayerId: 'host-1', players, playerCount: 1 + players.length, started: false, ...overrides };
}

async function hostRoom(registry: RoomRegistry, room: Room = roomWith([])) {
  const hostTransport = new FakeTransport();
  const code = registry.generate();
  await hostTransport.connect(undefined, registry.transportIdFor(code));
  const manager = new ConnectionManager(hostTransport, room, () => {});
  return { code, manager };
}

/** Joins a fresh Guest into `code`'s Room for real, so its `reconnectToken` is one the Host actually recognizes. */
async function joinAsGuest(registry: RoomRegistry, code: string, name: string) {
  const joined = await joinRoom(new FakeTransport(), registry, code, name);
  if (joined.status !== 'joined') throw new Error('setup failed: could not join as Guest');
  return joined;
}

function noopCallbacks(): ReconnectCallbacks {
  return {
    onGameState: vi.fn(),
    onGameStarted: vi.fn(),
    onSessionEnded: vi.fn(),
    onPlaceBetReady: vi.fn(),
  };
}

describe('attemptReconnect', () => {
  it('resolves "no-identity" without touching the transport, when this device holds no stored identity for the Room Code', async () => {
    const registry = new RoomRegistry();
    const storage = new FakeStorage();
    const transport = new FakeTransport();
    const connectSpy = vi.spyOn(transport, 'connect');

    const result = await attemptReconnect(transport, registry, storage, 'ABCDEF', noopCallbacks());

    expect(result).toEqual({ status: 'no-identity' });
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it('reconnects to the Host and wires the live connection up to the callbacks, when the Host recognizes the stored reconnectToken', async () => {
    const registry = new RoomRegistry();
    const { code } = await hostRoom(registry);
    const joined = await joinAsGuest(registry, code, 'Alex');
    const storage = new FakeStorage();
    saveIdentity(storage, code, { playerId: joined.playerId, reconnectToken: joined.reconnectToken });
    const transport = new FakeTransport();
    const callbacks = noopCallbacks();

    const result = await attemptReconnect(transport, registry, storage, code, callbacks);

    expect(result).toEqual({ status: 'joined', playerId: joined.playerId });
    expect(callbacks.onPlaceBetReady).toHaveBeenCalledWith(expect.any(Function));
    expect(callbacks.onGameState).toHaveBeenCalled();
  });

  it("re-saves this device's stored identity once the Host confirms it, using the Host's returned reconnectToken", async () => {
    const registry = new RoomRegistry();
    const { code } = await hostRoom(registry);
    const joined = await joinAsGuest(registry, code, 'Alex');
    const storage = new FakeStorage();
    saveIdentity(storage, code, { playerId: joined.playerId, reconnectToken: joined.reconnectToken });
    const transport = new FakeTransport();

    await attemptReconnect(transport, registry, storage, code, noopCallbacks());

    expect(loadIdentity(storage, code)).toEqual({ playerId: joined.playerId, reconnectToken: joined.reconnectToken });
  });

  it('resolves "unknown-player" and skips wiring the connection, when the Host does not recognize the stored reconnectToken', async () => {
    const registry = new RoomRegistry();
    const { code } = await hostRoom(registry);
    const storage = new FakeStorage();
    saveIdentity(storage, code, { playerId: 'p1', reconnectToken: 'a-stale-or-foreign-token' });
    const transport = new FakeTransport();
    const callbacks = noopCallbacks();

    const result = await attemptReconnect(transport, registry, storage, code, callbacks);

    expect(result).toEqual({ status: 'unknown-player' });
    expect(callbacks.onPlaceBetReady).not.toHaveBeenCalled();
  });

  it('passes through "invalid-room" and "unreachable" results from the underlying rejoin attempt', async () => {
    const registry = new RoomRegistry();
    const storage = new FakeStorage();
    saveIdentity(storage, 'NOPE12', { playerId: 'p1', reconnectToken: 'some-token' });

    const result = await attemptReconnect(new FakeTransport(), registry, storage, 'NOPE12', noopCallbacks());

    expect(result).toEqual({ status: 'invalid-room' });
  });

  it('retries a "no response" rejoin attempt with a short delay, succeeding once the Host becomes reachable again', async () => {
    const registry = new RoomRegistry();
    const { code } = await hostRoom(registry);
    const joined = await joinAsGuest(registry, code, 'Alex');
    const storage = new FakeStorage();
    saveIdentity(storage, code, { playerId: joined.playerId, reconnectToken: joined.reconnectToken });
    const transport = new FakeTransport();
    const realConnect = transport.connect.bind(transport);
    const connectSpy = vi
      .spyOn(transport, 'connect')
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockImplementation(realConnect);
    const waits: number[] = [];

    const result = await attemptReconnect(transport, registry, storage, code, noopCallbacks(), async (ms) => void waits.push(ms));

    expect(result).toEqual({ status: 'joined', playerId: joined.playerId });
    expect(connectSpy).toHaveBeenCalledTimes(3);
    expect(waits.length).toBe(2);
    expect(waits.every((ms) => ms > 0)).toBe(true);
  });

  it('gives up with "unreachable" after exhausting its retry budget, when the Host never responds', async () => {
    const registry = new RoomRegistry();
    const storage = new FakeStorage();
    saveIdentity(storage, 'ABCDEF', { playerId: 'p1', reconnectToken: 'a-token' });
    const transport = new FakeTransport();
    vi.spyOn(transport, 'connect').mockRejectedValue(new Error('network error'));
    const waits: number[] = [];

    const result = await attemptReconnect(transport, registry, storage, 'ABCDEF', noopCallbacks(), async (ms) => void waits.push(ms));

    expect(result).toEqual({ status: 'unreachable' });
    expect(waits.length).toBeGreaterThanOrEqual(1);
  });

  it('never retries an explicit "unknown-player" rejection from the Host', async () => {
    const registry = new RoomRegistry();
    const { code } = await hostRoom(registry);
    const storage = new FakeStorage();
    saveIdentity(storage, code, { playerId: 'p1', reconnectToken: 'a-stale-or-foreign-token' });
    const transport = new FakeTransport();
    const connectSpy = vi.spyOn(transport, 'connect');
    const wait = vi.fn(async () => {});

    const result = await attemptReconnect(transport, registry, storage, code, noopCallbacks(), wait);

    expect(result).toEqual({ status: 'unknown-player' });
    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("notifies onGameStarted once reconnected, when the Guest is rejoining a game that's already active", async () => {
    const registry = new RoomRegistry();
    const { code, manager } = await hostRoom(registry);
    const joined = await joinAsGuest(registry, code, 'Alex');
    manager.room = { ...manager.room, started: true };
    manager.startGame();
    const storage = new FakeStorage();
    saveIdentity(storage, code, { playerId: joined.playerId, reconnectToken: joined.reconnectToken });
    const callbacks = noopCallbacks();

    await attemptReconnect(new FakeTransport(), registry, storage, code, callbacks);

    expect(callbacks.onGameStarted).toHaveBeenCalledWith(code);
  });
});
