import { describe, expect, it } from 'vitest';
import { peerJsServerOptionsFromEnv } from './create-peerjs-transport';

describe('peerJsServerOptionsFromEnv', () => {
  it('targets the configured server when settings are set', () => {
    expect(
      peerJsServerOptionsFromEnv({
        VITE_PEERJS_HOST: 'localhost',
        VITE_PEERJS_PORT: '9000',
        VITE_PEERJS_PATH: '/wanna-bet',
        VITE_PEERJS_SECURE: 'false',
      }),
    ).toEqual({ host: 'localhost', port: 9000, path: '/wanna-bet', secure: false });
  });

  it('returns no options when no settings are set, keeping the public default', () => {
    expect(peerJsServerOptionsFromEnv({})).toBeUndefined();
  });
});
