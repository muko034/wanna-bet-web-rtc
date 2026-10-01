import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeTransport } from '../transport/fake-transport';
import { ConnectionManager, HEARTBEAT_INTERVAL_MS } from './connection-manager';
import type { Room } from './room';

function emptyRoom(): Room {
  return { code: 'ABCDEF', hostName: 'Host', hostPlayerId: 'host-1', players: [], playerCount: 1, started: false };
}

type StateMessage = { type: 'state'; seq: number; payload: { epoch: string; version: number; snapshot: { status: string } } };

async function hostWithGuest() {
  const hostTransport = new FakeTransport();
  const hostId = await hostTransport.connect();
  const manager = new ConnectionManager(hostTransport, emptyRoom(), () => {});
  const guestTransport = new FakeTransport();
  await guestTransport.connect(hostId);
  const states: StateMessage[] = [];
  guestTransport.onMessage((message) => {
    if ((message as { type?: string }).type === 'state') states.push(message as StateMessage);
  });
  guestTransport.send({ type: 'join', payload: { name: 'Alex' } });
  states.length = 0;
  return { manager, hostTransport, guestTransport, states };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Host heartbeat', () => {
  it('re-sends the current state to connected Guests every 3 s, unchanged in epoch and version', async () => {
    const { manager, states } = await hostWithGuest();

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS - 1);
    expect(states).toHaveLength(0);
    vi.advanceTimersByTime(1);
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);

    expect(HEARTBEAT_INTERVAL_MS).toBe(3_000);
    expect(states).toHaveLength(2);
    expect(states[1].payload).toEqual(states[0].payload);
    expect(states[1].seq).toBeGreaterThan(states[0].seq);
    manager.close();
  });

  it('raises the version once the snapshot changes, and keeps it across later heartbeats', async () => {
    const { manager, states } = await hostWithGuest();
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    const before = states[0].payload.version;

    manager.room = { ...manager.room, started: true };
    manager.startGame();
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);

    const afterChange = states.at(-2)!.payload;
    const heartbeat = states.at(-1)!.payload;
    expect(afterChange.version).toBe(before + 1);
    expect(afterChange.snapshot.status).toBe('active');
    expect(heartbeat).toEqual(afterChange);
    manager.close();
  });

  it('keeps one epoch for a Host boot and gives a restarted Host a different one', async () => {
    const first = await hostWithGuest();
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    const second = await hostWithGuest();
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);

    expect(first.states[0].payload.epoch).toBe(first.states[1].payload.epoch);
    expect(second.states[0].payload.epoch).not.toBe(first.states[0].payload.epoch);
    first.manager.close();
    second.manager.close();
  });

  it('rebroadcasts the current state at once on request, without waiting for the next heartbeat', async () => {
    const { manager, states } = await hostWithGuest();

    manager.rebroadcastState();

    expect(states).toHaveLength(1);
    expect(states[0].payload.snapshot.status).toBe('lobby');
    manager.close();
  });

  it('sends nothing while no Guest is connected', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    const manager = new ConnectionManager(hostTransport, emptyRoom(), () => {});
    const observer = new FakeTransport();
    await observer.connect(hostId);
    const received: unknown[] = [];
    observer.onMessage((message) => received.push(message));

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 5);

    expect(received).toEqual([]);
    manager.close();
  });

  it('stops when the Room closes', async () => {
    const { manager, states } = await hostWithGuest();
    manager.close();

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 5);

    expect(states).toEqual([]);
  });

  it('does not touch the Host UI state or the saved session', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    const onGameStateChange = vi.fn();
    const onSessionChange = vi.fn();
    const manager = new ConnectionManager(hostTransport, emptyRoom(), () => {}, undefined, undefined, onGameStateChange, onSessionChange);
    const guestTransport = new FakeTransport();
    await guestTransport.connect(hostId);
    guestTransport.send({ type: 'join', payload: { name: 'Alex' } });
    onGameStateChange.mockClear();
    onSessionChange.mockClear();

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 3);

    expect(onGameStateChange).not.toHaveBeenCalled();
    expect(onSessionChange).not.toHaveBeenCalled();
    manager.close();
  });
});
