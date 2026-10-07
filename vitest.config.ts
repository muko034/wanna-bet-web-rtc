import { mergeConfig, defineConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Default unit-test run: fast, no real networking. The PeerJS smoke suite needs a real browser
// (WebRTC isn't available in Node/jsdom) and a live local server, so it's excluded here and run
// separately with its own browser-mode config.
// Two projects: `*.test.ts` stays in Node; `*.test.tsx` component tests run in jsdom with a shared setup.
const exclude = ['**/node_modules/**', '**/*.smoke.test.ts'];

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: { name: 'node', include: ['src/**/*.test.ts'], exclude },
        },
        {
          extends: true,
          test: {
            name: 'dom',
            include: ['src/**/*.test.tsx'],
            exclude,
            environment: 'jsdom',
            setupFiles: ['./src/test-setup.ts'],
          },
        },
      ],
    },
  }),
);
