**Blocked by**: 25 (Reconnect retries with manual fallback)

**Status**: Implemented

## What to build

Wire connection-drop detection — on both the Lobby route and `/room/<code>/play` — to trigger the shared reconnect
implementation automatically, with no reload required. This replaces today's immediate "session ended" screen
(`room-lifecycle/04-host-disconnect-ends-session.md`, Guest-side behavior only) for a dropped connection: a drop now
always goes through the retry-then-manual-retry flow from `25-reconnect-retries-with-manual-fallback.md` before
anything is shown as failed. A bare dropped connection and a Host that is genuinely gone for good look identical to
the Guest at the moment the connection drops, so both now surface the same way — automatic retries, then a manual
"can't reach the Host" state if the Host truly doesn't come back.

This applies on either route: a drop while still in the Lobby recovers the same way as a drop mid-game.

## Acceptance criteria

- [x] A dropped connection (on either the Lobby route or `/room/<code>/play`) automatically triggers the shared
      reconnect implementation, with no reload needed.
- [x] The automatic-attempts-then-manual-retry behavior from `25-reconnect-retries-with-manual-fallback.md` applies
      identically to a detected drop as it does to a reload.
- [x] The old immediate "session ended" screen no longer appears for a Guest-side dropped connection — reaching a
      terminal, give-up state always happens through the retry-then-manual-retry flow.
- [x] A Guest never sees a stale game/lobby screen while a drop is being automatically recovered from — the
      "Reconnecting…" state is shown instead.
