import { describe, expect, it } from 'vitest';
import { FakeTransport } from './fake-transport';
import { PeerUnavailableError, RequestedIdTakenError } from './transport';

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

  it('lets a Host stay connected to more than one Guest at once', async () => {
    const host = new FakeTransport();
    const hostId = await host.connect();
    const guestA = new FakeTransport();
    const guestB = new FakeTransport();

    const received: unknown[] = [];
    host.onMessage((message) => received.push(message));
    await guestA.connect(hostId);
    await guestB.connect(hostId);
    guestA.send({ from: 'A' });
    guestB.send({ from: 'B' });

    expect(received).toEqual([{ from: 'A' }, { from: 'B' }]);
  });

  it('tags every received message with the sending peer\'s id', async () => {
    const host = new FakeTransport();
    const hostId = await host.connect();
    const guestA = new FakeTransport();
    const guestB = new FakeTransport();
    const guestAId = await guestA.connect(hostId);
    const guestBId = await guestB.connect(hostId);

    const received: Array<{ message: unknown; peerId: string }> = [];
    host.onMessage((message, peerId) => received.push({ message, peerId }));
    guestA.send({ from: 'A' });
    guestB.send({ from: 'B' });

    expect(received).toEqual([
      { message: { from: 'A' }, peerId: guestAId },
      { message: { from: 'B' }, peerId: guestBId },
    ]);
  });

  it('sends a message only to the addressed peer, when a peer id is given', async () => {
    const host = new FakeTransport();
    const hostId = await host.connect();
    const guestA = new FakeTransport();
    const guestB = new FakeTransport();
    const guestAId = await guestA.connect(hostId);
    await guestB.connect(hostId);

    const receivedByA: unknown[] = [];
    const receivedByB: unknown[] = [];
    guestA.onMessage((message) => receivedByA.push(message));
    guestB.onMessage((message) => receivedByB.push(message));
    host.send({ only: 'for A' }, guestAId);

    expect(receivedByA).toEqual([{ only: 'for A' }]);
    expect(receivedByB).toEqual([]);
  });

  it('becomes reachable under a specific requested id, so a Guest can connect without any shared lookup', async () => {
    const host = new FakeTransport();

    const id = await host.connect(undefined, 'my-requested-id');

    expect(id).toBe('my-requested-id');
    const guest = new FakeTransport();
    await expect(guest.connect('my-requested-id')).resolves.toEqual(expect.any(String));
  });

  it('rejects with RequestedIdTakenError when the requested id is already claimed', async () => {
    const first = new FakeTransport();
    await first.connect(undefined, 'duplicate-id');
    const second = new FakeTransport();

    await expect(second.connect(undefined, 'duplicate-id')).rejects.toBeInstanceOf(RequestedIdTakenError);
  });

  it('rejects with PeerUnavailableError when connecting to an id nobody is reachable under', async () => {
    const guest = new FakeTransport();

    await expect(guest.connect('nobody-here')).rejects.toBeInstanceOf(PeerUnavailableError);
  });
});
