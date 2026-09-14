import { afterEach, describe, expect, it } from 'vitest';
import { PeerJsTransport, type PeerJsServerOptions } from './peerjs-transport';
import { PeerUnavailableError } from './transport';

/**
 * Smoke-test suite for the real PeerJS-backed `Transport` adapter, run in a real browser
 * (WebRTC isn't available in Node/jsdom) against a live/local `peerjs-server`.
 *
 * Room/Connection Manager behavior stays covered by the fake-`Transport` unit suite — this
 * suite only validates the adapter's integration with real PeerJS/WebRTC.
 */

const EVENT_TIMEOUT_MS = 8000;

function serverOptions(): PeerJsServerOptions {
  const env = import.meta.env;
  return {
    host: env.VITE_PEERJS_SMOKE_HOST ?? 'localhost',
    port: env.VITE_PEERJS_SMOKE_PORT ? Number(env.VITE_PEERJS_SMOKE_PORT) : 9000,
    path: env.VITE_PEERJS_SMOKE_PATH ?? '/wanna-bet',
  };
}

/** Waits for the next observable PeerJS event instead of sleeping, failing loudly if it never arrives. */
function withTimeout<T>(promise: Promise<T>, description: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out after ${EVENT_TIMEOUT_MS}ms waiting for: ${description}`)),
      EVENT_TIMEOUT_MS,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function onceConnected(transport: PeerJsTransport): Promise<string> {
  return withTimeout(
    new Promise((resolve) => {
      transport.onConnectionChange((peerId, connected) => {
        if (connected) resolve(peerId);
      });
    }),
    'onConnectionChange(..., true)',
  );
}

function onceDisconnected(transport: PeerJsTransport): Promise<string> {
  return withTimeout(
    new Promise((resolve) => {
      transport.onConnectionChange((peerId, connected) => {
        if (!connected) resolve(peerId);
      });
    }),
    'onConnectionChange(..., false)',
  );
}

function onceMessage(transport: PeerJsTransport): Promise<{ message: unknown; peerId: string }> {
  return withTimeout(
    new Promise((resolve) => {
      transport.onMessage((message, peerId) => resolve({ message, peerId }));
    }),
    'onMessage',
  );
}

describe('PeerJsTransport smoke tests', () => {
  const openTransports: PeerJsTransport[] = [];

  function createTransport(options: PeerJsServerOptions = serverOptions()): PeerJsTransport {
    const transport = new PeerJsTransport(options);
    openTransports.push(transport);
    return transport;
  }

  afterEach(() => {
    for (const transport of openTransports.splice(0)) {
      transport.close();
    }
  });

  it('connects a Host and returns a usable Transport ID', async () => {
    const host = createTransport();

    const hostId = await host.connect();

    expect(hostId).toEqual(expect.any(String));
    expect(hostId.length).toBeGreaterThan(0);
  });

  it('connects a Guest to the Host\'s Transport ID, with both sides reporting connection-open', async () => {
    const host = createTransport();
    const hostId = await host.connect();
    const guest = createTransport();

    const hostConnected = onceConnected(host);
    const guestId = await guest.connect(hostId);
    const connectedGuestId = await hostConnected;

    expect(connectedGuestId).toBe(guestId);
  });

  it('delivers Guest-to-Host and Host-to-Guest messages unchanged through onMessage', async () => {
    const host = createTransport();
    const hostId = await host.connect();
    const guest = createTransport();
    await guest.connect(hostId);

    const hostReceived = onceMessage(host);
    guest.send({ type: 'join', payload: { name: 'Smoke Test Guest' } });
    await expect(hostReceived).resolves.toMatchObject({
      message: { type: 'join', payload: { name: 'Smoke Test Guest' } },
    });

    const guestReceived = onceMessage(guest);
    host.send({ type: 'welcome', payload: { seq: 1 } });
    await expect(guestReceived).resolves.toMatchObject({
      message: { type: 'welcome', payload: { seq: 1 } },
    });
  });

  it('delivers a Host broadcast send to every currently connected Guest', async () => {
    const host = createTransport();
    const hostId = await host.connect();
    const guestA = createTransport();
    const guestB = createTransport();

    const hostSawA = onceConnected(host);
    await guestA.connect(hostId);
    await hostSawA;

    const hostSawB = onceConnected(host);
    await guestB.connect(hostId);
    await hostSawB;

    const guestAReceived = onceMessage(guestA);
    const guestBReceived = onceMessage(guestB);
    host.send({ type: 'state', payload: { seq: 1 } });

    await expect(guestAReceived).resolves.toMatchObject({ message: { type: 'state', payload: { seq: 1 } } });
    await expect(guestBReceived).resolves.toMatchObject({ message: { type: 'state', payload: { seq: 1 } } });
  });

  it('reports onConnectionChange(..., false) and releases resources when a transport closes', async () => {
    const host = createTransport();
    const hostId = await host.connect();
    const guest = createTransport();
    await guest.connect(hostId);

    const hostSawDisconnect = onceDisconnected(host);
    guest.close();

    await expect(hostSawDisconnect).resolves.toEqual(expect.any(String));
  });

  it('rejects connect() with PeerUnavailableError when no peer is reachable under the requested id', async () => {
    const guest = createTransport();

    await expect(guest.connect('smoke-test-nobody-here')).rejects.toBeInstanceOf(PeerUnavailableError);
  });

  it('fails to connect within the test timeout when the configured server is unreachable', async () => {
    const guest = createTransport({ host: 'localhost', port: 9, path: '/unreachable' });

    await expect(withTimeout(guest.connect(), 'connect() against an unreachable server')).rejects.toThrow();
  });
});
