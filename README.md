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
- `npm run test:smoke` — manual PeerJS transport smoke tests, see below.

## PeerJS transport smoke tests

Validates the real PeerJS-backed `Transport` adapter against a live signaling server, in a real
headless browser (WebRTC needs one — Node/jsdom won't do). Separate from `npm test`.

1. Start a local server: `npm run peerjs-server` (listens on `localhost:9000/wanna-bet`).
2. In another terminal: `npm run test:smoke`.

Override the target host/port/path with `VITE_PEERJS_SMOKE_HOST`, `VITE_PEERJS_SMOKE_PORT`,
`VITE_PEERJS_SMOKE_PATH`. Success means all cases pass — Host/Guest connect, exchange messages,
report connection changes, and unreachable peers/servers reject instead of hanging.

## Challenge Bank

The bundled Challenge Bank content lives in `src/challenge-bank/data/*.yaml`, one file per entry.
`src/challenge-bank/challenge-bank.ts` is generated from those files and committed — edit the
YAML, then run:

```
npm run generate:challenge-bank
```

`npm test` fails if the committed file drifts from the YAML source, so regenerating is required
after any content change.

