import { PeerJsTransport, type PeerJsServerOptions } from './peerjs-transport';

type PeerJsEnv = Record<string, string | undefined>;

/**
 * Reads the optional `VITE_PEERJS_*` build settings. Returns `undefined` when none is set, so
 * PeerJS keeps its public cloud defaults.
 */
export function peerJsServerOptionsFromEnv(env: PeerJsEnv): PeerJsServerOptions | undefined {
  const options: PeerJsServerOptions = {};
  if (env.VITE_PEERJS_HOST) options.host = env.VITE_PEERJS_HOST;
  if (env.VITE_PEERJS_PORT) options.port = Number(env.VITE_PEERJS_PORT);
  if (env.VITE_PEERJS_PATH) options.path = env.VITE_PEERJS_PATH;
  if (env.VITE_PEERJS_SECURE) options.secure = env.VITE_PEERJS_SECURE === 'true';
  return Object.keys(options).length > 0 ? options : undefined;
}

/** The one place the app creates PeerJS-backed Transports (Host create, Host reopen, Guest). */
export function createPeerJsTransport(): PeerJsTransport {
  return new PeerJsTransport(peerJsServerOptionsFromEnv(import.meta.env));
}
