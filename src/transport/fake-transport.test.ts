import { describe, expect, it } from 'vitest';
import { FakeTransport } from './fake-transport';

describe('FakeTransport', () => {
  it('exposes a shareable id once connected, with no remote target given', async () => {
    const transport = new FakeTransport();

    const id = await transport.connect();

    expect(id).toEqual(expect.any(String));
    expect(id.length).toBeGreaterThan(0);
  });

  it('delivers a message sent by one connected peer to the other peer\'s onMessage handler', async () => {
    const host = new FakeTransport();
    const hostId = await host.connect();
    const guest = new FakeTransport();
    await guest.connect(hostId);

    const received: unknown[] = [];
    host.onMessage((message) => received.push(message));
    guest.send({ type: 'join', payload: { name: 'Alex' } });

    expect(received).toEqual([{ type: 'join', payload: { name: 'Alex' } }]);
  });

  it('notifies the Host\'s onConnectionChange handler when a Guest connects', async () => {
    const host = new FakeTransport();
    const hostId = await host.connect();
    const guest = new FakeTransport();

    const statusChanges: Array<{ peerId: string; connected: boolean }> = [];
    host.onConnectionChange((peerId, connected) => statusChanges.push({ peerId, connected }));
    const guestId = await guest.connect(hostId);

    expect(statusChanges).toEqual([{ peerId: guestId, connected: true }]);
  });
});
