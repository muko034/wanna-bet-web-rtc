import { mergeConfig, defineConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Default unit-test run: fast, Node-only, no real networking. The PeerJS smoke suite needs a
// real browser (WebRTC isn't available in Node/jsdom) and a live local server, so it's excluded
// here and run separately with its own browser-mode config.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      exclude: ['**/node_modules/**', '**/*.smoke.test.ts'],
    },
  }),
);
