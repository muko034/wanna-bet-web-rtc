import { Worker } from 'node:worker_threads';
import type { TestProject } from 'vitest/node';
import {
  PEERJS_SERVER_HOST,
  PEERJS_SERVER_PATH,
  PEERJS_SERVER_PORT,
} from './peerjs-server-config.ts';

declare module 'vitest' {
  export interface ProvidedContext {
    peerJsServer: { host: string; port: number; path: string };
  }
}

async function isServerRunning(): Promise<boolean> {
  try {
    await fetch(`http://${PEERJS_SERVER_HOST}:${PEERJS_SERVER_PORT}${PEERJS_SERVER_PATH}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * The server runs in a worker thread: PeerServer starts timers it cannot stop, so only terminating
 * the thread lets the test process exit.
 */
function startServer(): Promise<Worker> {
  const worker = new Worker(new URL('./peerjs-server.ts', import.meta.url), {
    execArgv: ['--experimental-strip-types'],
  });
  return new Promise((resolve, reject) => {
    worker.once('message', () => resolve(worker));
    worker.once('error', reject);
    worker.once('exit', (code) => reject(new Error(`PeerJS server exited with code ${code}`)));
  });
}

const SERVER_KEY = Symbol.for('wanna-bet.integration-peerjs-server');
type ServerHolder = { [SERVER_KEY]?: Promise<Worker | undefined> };

async function launchServer(): Promise<Worker | undefined> {
  if (!process.env.CI && (await isServerRunning())) return undefined;
  return startServer();
}

/**
 * Starts the PeerJS signaling server for the integration suite and stops it afterwards. Locally,
 * a server that already runs on the port is reused (as the E2E suite does); in CI a fresh one
 * always starts, so a busy port fails loudly.
 *
 * Browser mode calls this once per project (the root and each browser instance), so the first call
 * starts the server and the others wait for it. The first call also owns the teardown.
 */
export default async function setup(project: TestProject) {
  project.provide('peerJsServer', {
    host: PEERJS_SERVER_HOST,
    port: PEERJS_SERVER_PORT,
    path: PEERJS_SERVER_PATH,
  });

  const holder = globalThis as ServerHolder;
  const ownsServer = !holder[SERVER_KEY];
  holder[SERVER_KEY] ??= launchServer();
  const worker = await holder[SERVER_KEY];

  if (ownsServer && worker) return () => worker.terminate();
}
