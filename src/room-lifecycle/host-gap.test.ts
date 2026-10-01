import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeStorage } from '../fake-storage';
import type { GameState, PlaceBetPayload } from '../protocol/messages';
import { FakeTransport } from '../transport/fake-transport';
import { BET_CONFIRMATION_TIMEOUT_MS, BetDelivery } from './bet-delivery';
import { ConnectionManager, HEARTBEAT_INTERVAL_MS } from './connection-manager';
import { attemptReconnect } from './guest-reconnect';
import { HOST_SILENCE_TIMEOUT_MS, joinRoom } from './join-room';
import { saveIdentity } from './player-identity';
import { RoomRegistry } from './room-registry';
import type { Room } from './room';

const BET: PlaceBetPayload = { amount: 10, prediction: 'YES' };

/** A started game with the Host as Active Player and one Guest, Sam, who has a stored identity. */
async function startedGameWithSam() {
  const registry = new RoomRegistry();
  const hostTransport = new FakeTransport();
  const code = registry.generate();
  await hostTransport.connect(undefined, registry.transportIdFor(code));
  const room: Room = { code, hostName: 'Host', hostPlayerId: 'host-1', players: [], playerCount: 1, started: false };
  const manager = new ConnectionManager(hostTransport, room, () => {}, (ids) => ids[0], () => 'host-1');

  const joined = await joinRoom(new FakeTransport(), registry, code, 'Sam');
  if (joined.status !== 'joined') throw new Error('setup failed: Sam could not join');
  manager.room = { ...manager.room, started: true };
  manager.startGame();
  manager.startRound();

  const storage = new FakeStorage();
  saveIdentity(storage, code, { playerId: joined.playerId, reconnectToken: joined.reconnectToken });

  const placeBetMessages: unknown[] = [];
  hostTransport.onMessage((message) => {
    if ((message as { type?: string }).type === 'placeBet') placeBetMessages.push(message);
  });

  return { registry, hostTransport, code, manager, storage, samId: joined.playerId, placeBetMessages };
}

/** Sam's device: the same wiring `app.tsx` does between the reconnect loop and Bet delivery. */
function samsDevice(game: Awaited<ReturnType<typeof startedGameWithSam>>) {
  const renders: GameState[] = [];
  const failures: string[] = [];
  const reconnects = { started: 0, gaveUp: 0 };
  const delivery = new BetDelivery((roundKey) => failures.push(roundKey), () => connect());

  // The app closes the previous transport when it opens a new one, so only the current
  // transport's signals count.
  let current: FakeTransport | null = null;
  const connect = () => {
    reconnects.started++;
    const transport = new FakeTransport();
    current = transport;
    attemptReconnect(transport, game.registry, game.storage, game.code, {
      onGameState: (state) => {
        renders.push(state);
        delivery.onState(state);
      },
      onGameStarted: () => {},
      onConnectionDropped: () => {
        if (transport !== current) return;
        delivery.setSender(null);
        connect();
      },
      onPlaceBetReady: (sender) => {
        delivery.setSender(sender);
      },
      onBetRejected: (reason) => delivery.onRejected(reason),
    }).then((result) => {
      if (result.status === 'unreachable') {
        reconnects.gaveUp++;
        delivery.failPending();
      }
    });
  };

  const lockIn = (payload = BET) =>
    delivery.place({ roundKey: roundKey(game.manager.gameState!), playerId: game.samId, payload });
  return { renders, failures, reconnects, connect, lockIn };
}

function roundKey(state: GameState): string {
  return `${state.round!.activePlayerId}:${state.round!.challengeId}`;
}

const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('a Guest through a Host gap', () => {
  it('re-renders for a changed snapshot but not for an unchanged heartbeat', async () => {
    const game = await startedGameWithSam();
    const sam = samsDevice(game);
    sam.connect();
    await settle();
    const rendersAfterJoin = sam.renders.length;

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 4);
    expect(sam.renders).toHaveLength(rendersAfterJoin);

    game.manager.resolveRound('YES');
    expect(sam.renders).toHaveLength(rendersAfterJoin + 1);
    expect(sam.reconnects.started).toBe(1);
  });

  it('starts reconnecting after 9 s of Host silence and shows no failure', async () => {
    const game = await startedGameWithSam();
    const sam = samsDevice(game);
    sam.connect();
    await settle();
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    game.hostTransport.setBlackHole(true);

    await vi.advanceTimersByTimeAsync(HOST_SILENCE_TIMEOUT_MS - 1_000);
    expect(sam.reconnects.started).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(sam.reconnects.started).toBe(2);
    expect(sam.failures).toEqual([]);
  });

  it('keeps a Bet sent into the black hole pending, reconnects after 4 s, and lands it exactly once when the Host returns', async () => {
    const game = await startedGameWithSam();
    const sam = samsDevice(game);
    sam.connect();
    await settle();
    game.hostTransport.setBlackHole(true);

    sam.lockIn();
    await vi.advanceTimersByTimeAsync(BET_CONFIRMATION_TIMEOUT_MS - 1);
    expect(sam.reconnects.started).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sam.reconnects.started).toBe(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sam.failures).toEqual([]);

    game.hostTransport.setBlackHole(false);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(game.placeBetMessages).toHaveLength(1);
    expect(game.manager.gameState?.round?.bets).toEqual([{ playerId: game.samId }]);
    expect(sam.failures).toEqual([]);
    const reconnectsOnceSettled = sam.reconnects.started;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sam.reconnects.started).toBe(reconnectsOnceSettled);
  });

  it('shows the failure when the Host rejects the Bet', async () => {
    const game = await startedGameWithSam();
    const sam = samsDevice(game);
    sam.connect();
    await settle();

    sam.lockIn({ amount: 9_999, prediction: 'YES' });
    await settle();

    expect(sam.failures).toEqual([roundKey(game.manager.gameState!)]);
  });

  it('shows the failure only when the 5 min reconnect gives up', async () => {
    const game = await startedGameWithSam();
    const sam = samsDevice(game);
    sam.connect();
    await settle();
    game.hostTransport.setBlackHole(true);
    sam.lockIn();

    await vi.advanceTimersByTimeAsync(4 * 60_000);
    expect(sam.failures).toEqual([]);
    await vi.advanceTimersByTimeAsync(6 * 60_000);

    expect(sam.reconnects.gaveUp).toBe(1);
    expect(sam.failures).toEqual([roundKey(game.manager.gameState!)]);
  });
});
