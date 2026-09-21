import { describe, expect, it, vi } from 'vitest';
import { FakeTransport } from '../transport/fake-transport';
import { HostProtocol } from './host-protocol';
import type { GameState } from './messages';

async function connectedPair(): Promise<{
  hostTransport: FakeTransport;
  guestTransport: FakeTransport;
  guestId: string;
}> {
  const hostTransport = new FakeTransport();
  const hostId = await hostTransport.connect();
  const guestTransport = new FakeTransport();
  const guestId = await guestTransport.connect(hostId);
  return { hostTransport, guestTransport, guestId };
}

const gameState: GameState = {
  roomId: 'ABCDEF',
  status: 'active',
  activePlayerId: null,
  resolution: null,
  players: [],
  round: null,
};

describe('HostProtocol', () => {
  it('invokes the registered join handler with the typed payload and sending peerId on a valid join message', async () => {
    const { hostTransport, guestTransport, guestId } = await connectedPair();
    const protocol = new HostProtocol(hostTransport);
    const received: unknown[] = [];
    protocol.on('join', (payload, peerId) => received.push({ payload, peerId }));

    guestTransport.send({ type: 'join', payload: { name: 'Alex' } });

    expect(received).toEqual([{ payload: { name: 'Alex' }, peerId: guestId }]);
  });

  it('invokes independently registered join and rejoin handlers for their respective message types', async () => {
    const { hostTransport, guestTransport } = await connectedPair();
    const protocol = new HostProtocol(hostTransport);
    const joinReceived: unknown[] = [];
    const rejoinReceived: unknown[] = [];
    protocol.on('join', (payload) => joinReceived.push(payload));
    protocol.on('rejoin', (payload) => rejoinReceived.push(payload));

    guestTransport.send({ type: 'join', payload: { name: 'Alex' } });
    guestTransport.send({ type: 'rejoin', payload: { reconnectToken: 'tok-1' } });

    expect(joinReceived).toEqual([{ name: 'Alex' }]);
    expect(rejoinReceived).toEqual([{ reconnectToken: 'tok-1' }]);
  });

  it('drops an unrecognized message type: logs a warning, invokes no handler, sends no reply', async () => {
    const { hostTransport, guestTransport } = await connectedPair();
    const protocol = new HostProtocol(hostTransport);
    const handler = vi.fn();
    protocol.on('join', handler);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const guestReceived: unknown[] = [];
    guestTransport.onMessage((message) => guestReceived.push(message));

    guestTransport.send({ type: 'bogus', payload: {} });

    expect(handler).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    expect(guestReceived).toEqual([]);
    warn.mockRestore();
  });

  it('drops a recognized type with a malformed payload: logs a warning, invokes no handler, sends no reply', async () => {
    const { hostTransport, guestTransport } = await connectedPair();
    const protocol = new HostProtocol(hostTransport);
    const handler = vi.fn();
    protocol.on('placeBet', handler);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const guestReceived: unknown[] = [];
    guestTransport.onMessage((message) => guestReceived.push(message));

    guestTransport.send({ type: 'placeBet', payload: { amount: 'not-a-number', prediction: 'YES' } });

    expect(handler).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    expect(guestReceived).toEqual([]);
    warn.mockRestore();
  });

  it('sendWelcome sends only to the specified peerId, not broadcast', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    const guestA = new FakeTransport();
    const guestAId = await guestA.connect(hostId);
    const guestB = new FakeTransport();
    await guestB.connect(hostId);
    const protocol = new HostProtocol(hostTransport);
    const aReceived: unknown[] = [];
    const bReceived: unknown[] = [];
    guestA.onMessage((message) => aReceived.push(message));
    guestB.onMessage((message) => bReceived.push(message));

    protocol.welcome(guestAId, { playerId: 'p1', reconnectToken: 'tok-1' });

    expect(aReceived).toEqual([{ type: 'welcome', seq: 0, payload: { playerId: 'p1', reconnectToken: 'tok-1' } }]);
    expect(bReceived).toEqual([]);
  });

  it('sendRejected sends only to the specified peerId, not broadcast', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    const guestA = new FakeTransport();
    const guestAId = await guestA.connect(hostId);
    const guestB = new FakeTransport();
    await guestB.connect(hostId);
    const protocol = new HostProtocol(hostTransport);
    const aReceived: unknown[] = [];
    const bReceived: unknown[] = [];
    guestA.onMessage((message) => aReceived.push(message));
    guestB.onMessage((message) => bReceived.push(message));

    protocol.rejected(guestAId, { reason: 'ROOM_FULL', action: 'join' });

    expect(aReceived).toEqual([{ type: 'rejected', seq: 0, payload: { reason: 'ROOM_FULL', action: 'join' } }]);
    expect(bReceived).toEqual([]);
  });

  it('broadcastState sends to every connected peer', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    const guestA = new FakeTransport();
    await guestA.connect(hostId);
    const guestB = new FakeTransport();
    await guestB.connect(hostId);
    const protocol = new HostProtocol(hostTransport);
    const aReceived: unknown[] = [];
    const bReceived: unknown[] = [];
    guestA.onMessage((message) => aReceived.push(message));
    guestB.onMessage((message) => bReceived.push(message));

    protocol.broadcastState(gameState);

    expect(aReceived).toEqual([{ type: 'state', seq: 0, payload: gameState }]);
    expect(bReceived).toEqual([{ type: 'state', seq: 0, payload: gameState }]);
  });

  it('stamps a monotonically increasing seq across every send helper call, targeted or broadcast', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    const guestTransport = new FakeTransport();
    const guestId = await guestTransport.connect(hostId);
    const protocol = new HostProtocol(hostTransport);
    const received: unknown[] = [];
    guestTransport.onMessage((message) => received.push(message));

    protocol.welcome(guestId, { playerId: 'p1', reconnectToken: 'tok-1' });
    protocol.broadcastState(gameState);
    protocol.rejected(guestId, { reason: 'ROOM_FULL', action: 'join' });

    expect((received as Array<{ seq: number }>).map((m) => m.seq)).toEqual([0, 1, 2]);
  });
});
