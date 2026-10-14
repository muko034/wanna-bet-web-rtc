# Wanna Bet

Turn-based social betting game. The Host owns authoritative game state; Guests connect directly
over WebRTC.

## Getting started

```
npm install
npm run dev
```

## Testing

- `npm test` — fast unit suite (no real networking).
- `npm run test:integration` — PeerJS transport integration tests, see below.
- `npm run test:e2e` — Playwright browser suite, see below.

CI runs all three on every pull request and before every deploy. The two browser suites need Chromium
once: `npx playwright install chromium`.

## PeerJS transport integration tests

Validates the real PeerJS-backed `Transport` adapter against a live signaling server, in a real
headless browser (WebRTC needs one — Node/jsdom won't do). Separate from `npm test`.

`npm run test:integration` starts the PeerJS server itself (`localhost:9000/wanna-bet`) and stops it
afterwards. A server already running on that port is reused locally. Success means all cases pass —
Host/Guest connect, exchange messages, report connection changes, and unreachable peers/servers
reject instead of hanging.

To run the server on its own, use `npm run peerjs-server`. Its host, port and path live in
`scripts/peerjs-server-config.ts`.

## Playwright E2E suite

Drives a Host and a Guest, each in its own browser context (separate `localStorage`), through the real
app in Chromium over real WebRTC. Separate from `npm test`.

```
npm run test:e2e
```

Playwright starts the PeerJS server (`localhost:9000/wanna-bet`, the same one the integration tests use)
and the dev server (`localhost:5173`) itself, and reuses either if already running. Specs live in `e2e/`.

## Challenge Bank

The bundled Challenge Bank content lives in `src/challenge-bank/data/*.yaml`, one file per entry.
`src/challenge-bank/challenge-bank.ts` is generated from those files and committed — edit the
YAML, then run:

```
npm run generate:challenge-bank
```

`npm test` fails if the committed file drifts from the YAML source, so regenerating is required
after any content change.


## Custom PeerJS server

Optional build settings point the app at another PeerJS server: `VITE_PEERJS_HOST`,
`VITE_PEERJS_PORT`, `VITE_PEERJS_PATH`, `VITE_PEERJS_SECURE` (`true` or `false`). With none set,
the app uses the public PeerJS default.
