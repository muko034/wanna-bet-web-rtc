import { parentPort } from 'node:worker_threads';
import { PeerServer } from 'peer';
import { PEERJS_SERVER_PATH, PEERJS_SERVER_PORT } from './peerjs-server-config.ts';

/**
 * Runs the local PeerJS signaling server. Start it with `npm run peerjs-server`, or as a worker
 * thread (the integration suite does), where it tells the parent once it listens.
 */
PeerServer({ port: PEERJS_SERVER_PORT, path: PEERJS_SERVER_PATH }, () => {
  console.log(`Started PeerServer on port ${PEERJS_SERVER_PORT}, path ${PEERJS_SERVER_PATH}`);
  parentPort?.postMessage('listening');
});
