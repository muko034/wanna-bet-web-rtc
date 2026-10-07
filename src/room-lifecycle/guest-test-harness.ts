import { vi } from 'vitest';
import { FakeTransport } from '../transport/fake-transport';
import { ConnectionManager } from './connection-manager';
import { joinRoom } from './join-room';
import { saveIdentity } from './player-identity';
import { roomRegistry } from './room-registry-instance';
import type { Room } from './room';

/** A Guest transport factory that records every Transport it hands out, with `close` spied on. */
export function trackedGuestTransports() {
  const transports: FakeTransport[] = [];
  const createGuestTransport = () => {
    const transport = new FakeTransport();
    vi.spyOn(transport, 'close');
    transports.push(transport);
    return transport;
  };
  const closedCount = (transport: FakeTransport) => vi.mocked(transport.close).mock.calls.length;
  return { transports, createGuestTransport, closedCount };
}

/** Stores an identity no Host recognizes, so a reconnect for `code` keeps retrying while no Host is up. */
export function storeStaleIdentity(code: string): void {
  saveIdentity(localStorage, code, { playerId: 'p1', reconnectToken: 'a-stale-token' });
}

/** Starts a real Host for a fresh Room with one Guest, and stores that Guest's identity on this device. Returns the Room Code. */
export async function hostRoomWithStoredGuest(): Promise<string> {
  const code = roomRegistry.generate();
  const hostTransport = new FakeTransport();
  await hostTransport.connect(undefined, roomRegistry.transportIdFor(code));
  const room: Room = { code, hostName: 'Host', hostPlayerId: 'host-1', players: [], playerCount: 1, started: false };
  new ConnectionManager(hostTransport, room, () => {});
  const joined = await joinRoom(new FakeTransport(), roomRegistry, code, 'Alex');
  if (joined.status !== 'joined') throw new Error('setup failed: could not join as Guest');
  saveIdentity(localStorage, code, { playerId: joined.playerId, reconnectToken: joined.reconnectToken });
  return code;
}
