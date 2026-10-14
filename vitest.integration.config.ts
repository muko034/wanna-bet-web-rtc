import { mergeConfig, defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import viteConfig from './vite.config.ts';

// PeerJS needs real WebRTC (RTCPeerConnection, navigator), which Node and jsdom don't provide.
// This suite runs in a real headless Chromium via Playwright instead, against a local
// PeerJS server that `globalSetup` starts.
export default mergeConfig(
  viteConfig,
  defineConfig({
    optimizeDeps: {
      include: ['peerjs'],
    },
    test: {
      globalSetup: ['./scripts/integration-global-setup.ts'],
      include: ['**/*.integration.test.ts'],
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        instances: [{ browser: 'chromium' }],
      },
    },
  }),
);
