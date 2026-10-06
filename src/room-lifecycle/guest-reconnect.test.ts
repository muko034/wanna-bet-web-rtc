import { describe, expect, it, vi } from 'vitest';
import { FakeTransport } from '../transport/fake-transport';
import { PeerUnavailableError } from '../transport/transport';
import { FakeStorage } from '../fake-storage';
import { RoomRegistry } from './room-registry';
import { ConnectionManager } from './connection-manager';
import { attemptReconnect, muteWhile, type ReconnectCallbacks } from './guest-reconnect';
import { joinRoom, makeGameStartedHandler } from './join-room';
import { saveIdentity, loadIdentity } from './player-identity';
import { leaveRoom } from './guest-leave';
import type { Room } from './room';
import type { GameState } from '../protocol/messages';

function roomWith(players: Room['players'], overrides: Partial<Room> = {}): Room {
  return { code: 'ABCDEF', hostName: 'Host', hostPlayerId: 'host-1', players, playerCount: 1 + players.length, started: false, ...overrides };
}

async function hostRoom(registry: RoomRegistry, room: Room = roomWith([])) {
  const hostTransport = new FakeTransport();
  const code = registry.generate();
  await hostTransport.connect(undefined, registry.transportIdFor(code));
  const manager = new ConnectionManager(hostTransport, room, () => {});
  return { code, manager, hostTransport };
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
    onConnectionDropped: vi.fn(),
    onPlaceBetReady: vi.fn(),
    onBetRejected: vi.fn(),
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

  it('retries while no Host is registered under the Room Code, succeeding once the Host comes back', async () => {
    const registry = new RoomRegistry();
    const { code } = await hostRoom(registry);
    const joined = await joinAsGuest(registry, code, 'Alex');
    const storage = new FakeStorage();
    saveIdentity(storage, code, { playerId: joined.playerId, reconnectToken: joined.reconnectToken });
    const transport = new FakeTransport();
    const realConnect = transport.connect.bind(transport);
    vi.spyOn(transport, 'connect')
      .mockRejectedValueOnce(new PeerUnavailableError('no peer'))
      .mockRejectedValueOnce(new PeerUnavailableError('no peer'))
      .mockImplementation(realConnect);
    const wait = vi.fn(async () => {});

    const result = await attemptReconnect(transport, registry, storage, code, noopCallbacks(), wait);

    expect(result).toEqual({ status: 'joined', playerId: joined.playerId });
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it('gives up with "unreachable", not "invalid-room", when no Host ever registers under the Room Code — retrying for up to ~5 minutes with a backoff capped at 20s', async () => {
    const registry = new RoomRegistry();
    const storage = new FakeStorage();
    saveIdentity(storage, 'NOPE12', { playerId: 'p1', reconnectToken: 'some-token' });
    const waits: number[] = [];

    const result = await attemptReconnect(new FakeTransport(), registry, storage, 'NOPE12', noopCallbacks(), async (ms) => void waits.push(ms));

    expect(result).toEqual({ status: 'unreachable' });
    // Doubles from 2s up to the 20s cap, then holds there until the ~5 minute budget is spent.
    expect(waits).toEqual([2_000, 4_000, 8_000, 16_000, ...Array(14).fill(20_000)]);
    expect(waits.every((ms) => ms <= 20_000)).toBe(true);
    expect(waits.reduce((total, ms) => total + ms, 0)).toBeGreaterThanOrEqual(5 * 60_000);
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

  it("notifies onConnectionDropped when the live connection this attempt just joined is lost, so a caller can drive another reconnect attempt automatically", async () => {
    const registry = new RoomRegistry();
    const { code, hostTransport } = await hostRoom(registry);
    const joined = await joinAsGuest(registry, code, 'Alex');
    const storage = new FakeStorage();
    saveIdentity(storage, code, { playerId: joined.playerId, reconnectToken: joined.reconnectToken });
    const transport = new FakeTransport();
    const callbacks = noopCallbacks();

    const result = await attemptReconnect(transport, registry, storage, code, callbacks);
    if (result.status !== 'joined') throw new Error('setup failed: expected to reconnect');
    hostTransport.disconnect();

    expect(callbacks.onConnectionDropped).toHaveBeenCalledOnce();
  });

  it("re-notifies onGameStarted on a rejoin that follows a drop, since the Host resends the in-progress GameState on every rejoin", async () => {
    const registry = new RoomRegistry();
    const { code, manager } = await hostRoom(registry);
    const joined = await joinAsGuest(registry, code, 'Alex');
    manager.room = { ...manager.room, started: true };
    manager.startGame();
    const storage = new FakeStorage();
    saveIdentity(storage, code, { playerId: joined.playerId, reconnectToken: joined.reconnectToken });
    const callbacks = noopCallbacks();

    // Simulates a Guest reconnecting a second time on a fresh Transport, as a caller's
    // `onConnectionDropped` handler would do after the first connection dropped.
    await attemptReconnect(new FakeTransport(), registry, storage, code, callbacks);

    expect(callbacks.onGameStarted).toHaveBeenCalledWith(code);
  });

  it("reports the Host's rejection of a placed Bet through onBetRejected", async () => {
    const registry = new RoomRegistry();
    const hostTransport = new FakeTransport();
    const code = registry.generate();
    await hostTransport.connect(undefined, registry.transportIdFor(code));
    const manager = new ConnectionManager(hostTransport, roomWith([]), () => {}, undefined, () => 'host-1');
    const joined = await joinAsGuest(registry, code, 'Alex');
    manager.room = { ...manager.room, started: true };
    manager.startGame();
    manager.startRound();
    const storage = new FakeStorage();
    saveIdentity(storage, code, { playerId: joined.playerId, reconnectToken: joined.reconnectToken });
    const callbacks = noopCallbacks();
    await attemptReconnect(new FakeTransport(), registry, storage, code, callbacks);
    const placeBet = vi.mocked(callbacks.onPlaceBetReady).mock.calls[0][0]!;

    placeBet({ amount: 9999, prediction: 'YES', challengeId: manager.gameState!.round!.challengeId });

    expect(callbacks.onBetRejected).toHaveBeenCalledExactlyOnceWith('INVALID_BET_AMOUNT');
  });

  it('reports a Bet refused for a replaced Challenge through onBetRejected as STALE_CHALLENGE', async () => {
    const registry = new RoomRegistry();
    const hostTransport = new FakeTransport();
    const code = registry.generate();
    await hostTransport.connect(undefined, registry.transportIdFor(code));
    const manager = new ConnectionManager(hostTransport, roomWith([]), () => {}, undefined, () => 'host-1');
    const joined = await joinAsGuest(registry, code, 'Alex');
    manager.room = { ...manager.room, started: true };
    manager.startGame();
    manager.startRound();
    const storage = new FakeStorage();
    saveIdentity(storage, code, { playerId: joined.playerId, reconnectToken: joined.reconnectToken });
    const callbacks = noopCallbacks();
    await attemptReconnect(new FakeTransport(), registry, storage, code, callbacks);
    const placeBet = vi.mocked(callbacks.onPlaceBetReady).mock.calls[0][0]!;
    const seenChallengeId = manager.gameState!.round!.challengeId;
    manager.redrawChallenge();

    placeBet({ amount: 10, prediction: 'YES', challengeId: seenChallengeId });

    expect(callbacks.onBetRejected).toHaveBeenCalledExactlyOnceWith('STALE_CHALLENGE');
  });
});

describe('leaveRoom', () => {
  async function connectedGuest() {
    const registry = new RoomRegistry();
    const { code, manager, hostTransport } = await hostRoom(registry);
    const joined = await joinAsGuest(registry, code, 'Alex');
    const storage = new FakeStorage();
    saveIdentity(storage, code, { playerId: joined.playerId, reconnectToken: joined.reconnectToken });
    const transport = new FakeTransport();
    const callbacks = noopCallbacks();
    await attemptReconnect(transport, registry, storage, code, callbacks);
    return { code, manager, hostTransport, transport, storage, callbacks, playerId: joined.playerId };
  }

  it('does not navigate the Guest back to the Game when the Host later broadcasts an active state', async () => {
    const { code, manager, transport, storage, callbacks } = await connectedGuest();

    leaveRoom(transport, storage, code);
    manager.room = { ...manager.room, started: true };
    manager.startGame();
    manager.startRound();

    expect(callbacks.onGameStarted).not.toHaveBeenCalled();
    expect(callbacks.onGameState).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));
  });

  it('does not navigate to the play route once the Guest has left', async () => {
    const registry = new RoomRegistry();
    const { code, manager } = await hostRoom(registry);
    const joined = await joinAsGuest(registry, code, 'Alex');
    const storage = new FakeStorage();
    saveIdentity(storage, code, { playerId: joined.playerId, reconnectToken: joined.reconnectToken });
    const navigate = vi.fn();
    const transport = new FakeTransport();
    await attemptReconnect(transport, registry, storage, code, { ...noopCallbacks(), onGameStarted: makeGameStartedHandler(vi.fn(), navigate) });

    leaveRoom(transport, storage, code);
    manager.room = { ...manager.room, started: true };
    manager.startGame();
    manager.startRound();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('navigates to the play route when the game starts while the Guest is still in', async () => {
    const registry = new RoomRegistry();
    const { code, manager } = await hostRoom(registry);
    const joined = await joinAsGuest(registry, code, 'Alex');
    const storage = new FakeStorage();
    saveIdentity(storage, code, { playerId: joined.playerId, reconnectToken: joined.reconnectToken });
    const navigate = vi.fn();
    await attemptReconnect(new FakeTransport(), registry, storage, code, { ...noopCallbacks(), onGameStarted: makeGameStartedHandler(vi.fn(), navigate) });

    manager.room = { ...manager.room, started: true };
    manager.startGame();
    manager.startRound();

    expect(navigate).toHaveBeenCalledWith(expect.stringContaining(`room/${code}/play`));
  });

  it("deletes the Guest's stored identity", async () => {
    const { code, transport, storage } = await connectedGuest();

    leaveRoom(transport, storage, code);

    expect(loadIdentity(storage, code)).toBeNull();
  });

  it('does not report the closed connection as a drop to reconnect from', async () => {
    const { code, transport, storage, callbacks } = await connectedGuest();

    leaveRoom(transport, storage, code);

    expect(callbacks.onConnectionDropped).not.toHaveBeenCalled();
  });

  it('sends `leave`, so the Host removes the Guest from the Room', async () => {
    const { code, manager, transport, storage, playerId } = await connectedGuest();
    manager.room = { ...manager.room, started: true };
    manager.startGame();

    leaveRoom(transport, storage, code);

    expect(manager.room.players.map((p) => p.playerId)).not.toContain(playerId);
  });
});

describe('the Host leaving the Room', () => {
  async function connectedGuestInStartedGame() {
    const registry = new RoomRegistry();
    const { code, manager } = await hostRoom(registry);
    const joined = await joinAsGuest(registry, code, 'Alex');
    const storage = new FakeStorage();
    saveIdentity(storage, code, { playerId: joined.playerId, reconnectToken: joined.reconnectToken });
    const callbacks = noopCallbacks();
    await attemptReconnect(new FakeTransport(), registry, storage, code, callbacks);
    manager.room = { ...manager.room, started: true };
    manager.startGame();
    manager.startRound();
    return { code, manager, storage, callbacks };
  }

  it('hands the Guest the ended state and deletes its stored identity for the Room', async () => {
    const { code, manager, storage, callbacks } = await connectedGuestInStartedGame();

    manager.leave();

    expect(callbacks.onGameState).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ended' }));
    expect(loadIdentity(storage, code)).toBeNull();
  });

  it('keeps the identity while the Game is still on', async () => {
    const { code, storage } = await connectedGuestInStartedGame();

    expect(loadIdentity(storage, code)).not.toBeNull();
  });
});

describe('muteWhile', () => {
  const state: GameState = { roomId: 'ABCDEF', status: 'active', challengerId: 'host-1', resolution: null, players: [], round: null };

  it('drops game-state, game-started and connection-dropped signals while muted', () => {
    const callbacks = noopCallbacks();
    const muted = muteWhile(() => true, callbacks);

    muted.onGameState(state);
    muted.onGameStarted('ABCDEF');
    muted.onConnectionDropped();

    expect(callbacks.onGameState).not.toHaveBeenCalled();
    expect(callbacks.onGameStarted).not.toHaveBeenCalled();
    expect(callbacks.onConnectionDropped).not.toHaveBeenCalled();
  });

  it('forwards those signals once no longer muted', () => {
    const callbacks = noopCallbacks();
    let isMuted = true;
    const muted = muteWhile(() => isMuted, callbacks);

    isMuted = false;
    muted.onGameState(state);
    muted.onGameStarted('ABCDEF');
    muted.onConnectionDropped();

    expect(callbacks.onGameState).toHaveBeenCalledWith(state);
    expect(callbacks.onGameStarted).toHaveBeenCalledWith('ABCDEF');
    expect(callbacks.onConnectionDropped).toHaveBeenCalledOnce();
  });

  it('always forwards Bet readiness and rejections', () => {
    const callbacks = noopCallbacks();
    const muted = muteWhile(() => true, callbacks);

    muted.onPlaceBetReady(null);
    muted.onBetRejected('not-open' as never);

    expect(callbacks.onPlaceBetReady).toHaveBeenCalledWith(null);
    expect(callbacks.onBetRejected).toHaveBeenCalledWith('not-open');
  });
});
