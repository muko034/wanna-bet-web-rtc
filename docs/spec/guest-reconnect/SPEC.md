## Problem Statement

A Guest's connection to the Host can be lost two ways: they reload their browser (accidental refresh, closing and
reopening a tab), or their connection just drops (a network blip, briefly backgrounding a mobile browser). Today,
neither case recovers gracefully once the game has started. Reloading `/room/<code>/play` shows "Page not found" —
the started-game route never attempts to reconnect, unlike the Lobby route, which already rejoins a Guest from their
stored identity. And any dropped connection, however brief, is treated as an immediate, unrecoverable "session ended"
— there is no retry, automatic or manual. In both cases the Guest is knocked out of a game the Host and everyone else
is still playing, with no way back in.

## Solution

Reconnecting a Guest — whether triggered by an explicit page reload or a detected connection drop — always goes
through one shared reconnect path, regardless of which route the Guest is on (Lobby or started game) or what
triggered it.

A page reload on the started-game route drives that same reconnect path immediately on mount, using the Guest's
stored identity, instead of falling through to "Page not found." A Guest with no stored identity for that Room still
sees the ordinary join form.

A dropped connection (on either route) no longer ends the session outright. It drives the same reconnect path
automatically: a small, fixed number of attempts with a short delay between them. If none succeed, the Guest sees a
"can't reach the Host" state with a manual Retry button that repeats the same attempt. An explicit rejection from the
Host (e.g. an unrecognized identity) is never retried — only the "no response at all" case is. This replaces today's
immediate "session ended" screen: reaching a terminal, "give up" state now always happens through this
retry-then-manual-retry flow, never as an instant dead end, because a bare dropped connection and a Host that is
genuinely gone for good look identical to the Guest — there is no way to tell them apart at the moment the connection
drops.

## User Stories

1. As a Guest, I want reloading my browser mid-game to reconnect me to the game in progress, so that an accidental
   refresh doesn't knock me out of a game everyone else is still playing.
2. As a Guest reconnecting into an already-started game, I want to see the current, live Game State, so that I'm not
   looking at a stale Lobby view or missing what's happened since I left.
3. As a Guest who has never joined this Room (or cleared my browser data), I want to see the ordinary join form when
   I open the started-game link, so that "Page not found" doesn't greet me for a Room I'm allowed to see.
4. As a Guest attempting to join a Room whose game has already started, I want a clear "game already started" message,
   so that I understand why I can't join fresh mid-round.
5. As a Guest whose stored identity the Host no longer recognizes, I want to fall back to the ordinary join form, so
   that I'm not stuck when my saved reconnect details have gone stale.
6. As a Guest whose connection drops during the game (a network blip, backgrounding my browser), I want to be
   reconnected automatically without having to do anything, so that a brief interruption doesn't end my session.
7. As a Guest whose automatic reconnect attempts all fail, I want a clear "can't reach the Host" message with a way to
   try again, so that I'm not stuck on a spinner forever or told the session is over when the Host might just be
   slow to respond.
8. As a Guest retrying manually after automatic reconnect failed, I want that retry to behave the same way automatic
   reconnect did, so that the recovery path is consistent regardless of who triggered it.
9. As a Guest, I want a dedicated "Reconnecting…" state while reconnect attempts are in progress, so that I'm never
   shown a stale game or lobby screen while my connection is actually down.
10. As a Guest, I want this reconnect behavior to work the same way whether I'm still in the Lobby or already in a
    started game, so that where I happen to be doesn't change how recovery works.
11. As a developer, I want the Lobby's join screen and the started-game route to drive the exact same reconnect
    implementation, so that reconnect behavior can't silently drift between the two call sites.

## Implementation Decisions

- **One shared reconnect implementation**, extracted from the Lobby's existing join screen (which already loads a
  Guest's stored identity and performs a `rejoin` against the Host). Both the Lobby route and the started-game route
  drive this same implementation; a connection-drop detector on either route also drives it. There is no route
  redirect — the started-game route resolves its own reconnect state in place, without bouncing through the Lobby
  route.
- **Trigger conditions** for the shared reconnect path: (a) the started-game route mounts with no live Game State and
  a stored identity exists for that Room Code, or (b) a live connection's drop is detected, on either route.
- **No stored identity** on the started-game route routes the Guest to the ordinary join form instead of a
  reconnect attempt. Joining fresh once the game has started is rejected by the Host's existing "game already
  started" handling — no new player is created mid-game.
- **Unrecognized stored identity** (the Host rejects the reconnect attempt as an unknown player) falls back to the
  ordinary join form, exactly as it already does on the Lobby route today.
- **Retry policy**, applied uniformly everywhere the shared reconnect path is invoked (reload, connection drop, or a
  manual Retry click): a small, fixed number of attempts with a short delay between them, but only for "no response"
  failures (timeout / Host unreachable). An explicit rejection from the Host is never retried — it is treated as
  final immediately, since retrying an answer the Host already gave can't succeed.
- **Exhausted retries** surface a "can't reach the Host" state with a manual Retry button. Clicking Retry re-invokes
  the same shared reconnect path (including its own retry budget), not a single bare attempt.
- **UI while reconnecting**: a dedicated full "Reconnecting…" state replaces the game/lobby view entirely for the
  duration of a reconnect attempt — the Guest is never left looking at a stale screen while disconnected.
- **Supersedes** the "session ended" terminal state described in `room-lifecycle/04-host-disconnect-ends-session.md`
  for a Guest-side dropped connection: that immediate dead end is replaced everywhere by this retry-then-manual-retry
  flow. (`04` itself still holds for the Host's own tab-close case, from the Host's perspective — this slice only
  changes what a *Guest* sees when their own connection drops.)
- **No Host-side changes are required.** The Host's existing rejoin handling already re-sends the current, live Game
  State to a reconnecting Guest, whether the game is in the Lobby or already active.

## Testing Decisions

- **Seam**: the same `Transport` interface fake already used by `room-lifecycle`'s existing tests (see
  `room-lifecycle/SPEC.md`) — no real WebRTC/PeerJS/browser needed. The shared reconnect implementation is tested
  once, at this seam, and both call sites (Lobby route, started-game route) are covered by testing that they invoke
  it correctly, not by re-testing the reconnect logic itself twice.
- Modules tested: the extracted shared reconnect implementation (identity lookup, `rejoin` attempt, retry budget,
  give-up state), and each route's thin wiring into it (what triggers the call, what state each route renders for
  each outcome).
- Prior art: `room-lifecycle`'s existing fake-`Transport` unit tests for join/reconnect matching are the direct
  precedent for testing this reconnect path the same way, rather than reaching for browser/WebRTC integration tests.

## Out of Scope

- Host migration — there is still no promotion of a Guest to a new Host if the Host is gone for good (ADR 0001).
- Persisting or restoring any Game State for the Guest beyond their own identity — a reconnecting Guest gets the
  Host's current live state; it holds no Game State snapshot of its own (`host-persistence` remains Host-only).
- Changing the Host's own reload/crash recovery (`host-persistence` slice) — this is Guest-side only.
- An indefinite or time-boxed automatic retry loop — automatic retries are a small fixed count; beyond that it is
  always a manual, human-triggered Retry.
- Any UI that keeps the last-known game view visible in the background while reconnecting (e.g. a banner) — the
  reconnecting state fully replaces the game/lobby view.
- Host-side changes of any kind — the existing rejoin handling already does what this slice needs.

## Further Notes

This slice is a direct continuation of `room-lifecycle`'s existing reconnect work (`03-persistent-player-id-and-reconnect.md`)
and revises the Guest-side behavior described in `04-host-disconnect-ends-session.md`. It depends on nothing from
`host-persistence`, `host-admin`, or `round-engine`, and can be built independently once `room-lifecycle`'s join/reconnect
flow (items 1-4) is in place.
