import { defineConfig, devices } from '@playwright/test';

// Opt-in browser suite (`npm run test:e2e`). Drives a Host context and a Guest context in real
// Chromium against the dev server and a local PeerJS server. Ports match the smoke tests'
// `npm run peerjs-server`, so a server already running for them is reused.
const APP_PORT = 5173;
const PEERJS_PORT = 9000;
const PEERJS_PATH = '/wanna-bet';

export default defineConfig({
  testDir: './e2e',
  // One signaling server and one browser run the whole suite; parallel Rooms add nothing.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${APP_PORT}/wanna-bet-web-rtc/`,
    // The app picks Polish for any non-English browser, and the tests read English labels.
    locale: 'en-US',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run peerjs-server',
      url: `http://localhost:${PEERJS_PORT}${PEERJS_PATH}`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npm run dev -- --port ${APP_PORT} --strictPort`,
      url: `http://localhost:${APP_PORT}/wanna-bet-web-rtc/`,
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_PEERJS_HOST: 'localhost',
        VITE_PEERJS_PORT: String(PEERJS_PORT),
        VITE_PEERJS_PATH: PEERJS_PATH,
        VITE_PEERJS_SECURE: 'false',
      },
    },
  ],
});
