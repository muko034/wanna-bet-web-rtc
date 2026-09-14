import { describe, expect, it, vi } from 'vitest';
import { FakeTransport } from '../transport/fake-transport';
import { GuestProtocol } from './guest-protocol';
import type { GameState } from './messages';

async function connectedPair(): Promise<{ hostTransport: FakeTransport; guestTransport: FakeTransport }> {
  const hostTransport = new FakeTransport();
  const hostId = await hostTransport.connect();
  const guestTransport = new FakeTransport();
  await guestTransport.connect(hostId);
  return { hostTransport, guestTransport };
}

const gameState: GameState = {
  roomId: 'ABCDEF',
  status: 'active',
  players: [],
  round: null,
};

describe('GuestProtocol', () => {
  it('invokes the registered welcome handler with the typed payload and seq on a valid welcome message', async () => {
    const { hostTransport, guestTransport } = await connectedPair();
    const protocol = new GuestProtocol(guestTransport);
    const received: unknown[] = [];
    protocol.on('welcome', (payload, seq) => received.push({ payload, seq }));

    hostTransport.send({ type: 'welcome', seq: 5, payload: { playerId: 'p1', reconnectToken: 'tok-1' } });

    expect(received).toEqual([{ payload: { playerId: 'p1', reconnectToken: 'tok-1' }, seq: 5 }]);
  });

  it('invokes the registered state handler with the typed payload and seq on a valid state message', async () => {
    const { hostTransport, guestTransport } = await connectedPair();
    const protocol = new GuestProtocol(guestTransport);
    const received: unknown[] = [];
    protocol.on('state', (payload, seq) => received.push({ payload, seq }));

    hostTransport.send({ type: 'state', seq: 7, payload: gameState });

    expect(received).toEqual([{ payload: gameState, seq: 7 }]);
  });

  it('drops an unrecognized message type: logs a warning and invokes no handler', async () => {
    const { hostTransport, guestTransport } = await connectedPair();
    const protocol = new GuestProtocol(guestTransport);
    const handler = vi.fn();
    protocol.on('welcome', handler);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    hostTransport.send({ type: 'bogus', seq: 1, payload: {} });

    expect(handler).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('drops a recognized type with a malformed payload: logs a warning and invokes no handler', async () => {
    const { hostTransport, guestTransport } = await connectedPair();
    const protocol = new GuestProtocol(guestTransport);
    const handler = vi.fn();
    protocol.on('rejected', handler);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    hostTransport.send({ type: 'rejected', seq: 1, payload: { reason: 42, action: 'join' } });

    expect(handler).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('sendJoin sends a correctly-shaped join message with no seq field', async () => {
    const { hostTransport, guestTransport } = await connectedPair();
    const protocol = new GuestProtocol(guestTransport);
    const received: unknown[] = [];
    hostTransport.onMessage((message) => received.push(message));

    protocol.join({ name: 'Alex' });

    expect(received).toEqual([{ type: 'join', payload: { name: 'Alex' } }]);
  });

  it('sendRejoin sends a correctly-shaped rejoin message with no seq field', async () => {
    const { hostTransport, guestTransport } = await connectedPair();
    const protocol = new GuestProtocol(guestTransport);
    const received: unknown[] = [];
    hostTransport.onMessage((message) => received.push(message));

    protocol.rejoin({ reconnectToken: 'tok-1' });

    expect(received).toEqual([{ type: 'rejoin', payload: { reconnectToken: 'tok-1' } }]);
  });

  it('sendPlaceBet sends a correctly-shaped placeBet message with no seq field', async () => {
    const { hostTransport, guestTransport } = await connectedPair();
    const protocol = new GuestProtocol(guestTransport);
    const received: unknown[] = [];
    hostTransport.onMessage((message) => received.push(message));

    protocol.placeBet({ amount: 10, prediction: 'YES' });

    expect(received).toEqual([{ type: 'placeBet', payload: { amount: 10, prediction: 'YES' } }]);
  });

  it('sendLeave sends a correctly-shaped leave message with no seq field', async () => {
    const { hostTransport, guestTransport } = await connectedPair();
    const protocol = new GuestProtocol(guestTransport);
    const received: unknown[] = [];
    hostTransport.onMessage((message) => received.push(message));

    protocol.leave();

    expect(received).toEqual([{ type: 'leave', payload: {} }]);
  });
});
