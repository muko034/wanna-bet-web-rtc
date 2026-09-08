## Problem Statement

The Host's browser tab is the only copy of the Game State (per ADR 0001 — no backend, no database). An accidental reload
or crash of that one tab would otherwise destroy the entire in-progress game for everyone, with no way to recover.

## Solution

The Host serializes the full Game State to its own `localStorage` on every state change. On app load, if a matching
in-progress snapshot is found, the Host is offered to resume that session — restoring the Game State and Room identifier
so Guests can reconnect via the standard `room-lifecycle` reconnect flow — instead of always starting a fresh Room.

## User Stories

1. As the Host, I want my Game State saved automatically as the game progresses, so that an accidental reload doesn't
   lose the whole session.
2. As the Host, I want to be offered to resume my last in-progress session when I reopen the app, so that I can recover
   from a reload or crash.
3. As the Host, I want the resumed session to keep the same Room link/code as before, so that Guests can reconnect
   without a new link being distributed.
4. As the Host, I want the option to decline resuming and start fresh instead, so that I'm not forced back into an old
   session I no longer want.
5. As a Guest, after the Host resumes a session, I want to reconnect via the normal reconnect flow and see my own
   correct Points/status restored, so that the recovery is invisible to me beyond a brief reconnect.
6. As the Host, I want an old or incompatible snapshot (e.g. from a previous app version) to be detected and discarded
   rather than crashing the app, so that a stale save never blocks me from starting a new game.
7. As the Host, I want the snapshot cleared once I explicitly end the game, so that a finished game never resurfaces as
   a "resume?" prompt later.

## Implementation Decisions

- **Persistence module**: a `save(state)` / `load()` pair behind a `Storage` seam wrapping `localStorage`, keyed by Room
  id.
- **Save trigger**: every Game State mutation (from `round-engine` and `host-admin` actions) triggers a save,
  best-effort and non-blocking — gameplay is never delayed waiting on the write.
- **Snapshot contents**: wraps the canonical `GameState` shape (see `docs/message-protocol.md` and ADR 0003) as
  `{ schemaVersion, savedAt, state }` — players (including `status` from `host-admin`), round/rotation state, Points —
  plus the Room id/code so Guests reconnect to the same identifier.
- **Schema versioning**: snapshots include a `schemaVersion` field; on load, a mismatched version is treated as absent
  (discarded), never partially applied.
- **Snapshot lifecycle**: cleared on explicit "end game" (per `game-rules.md`'s Game Ending rules) and on a declined
  resume prompt.
- Guests are unaffected by this slice beyond the existing `room-lifecycle` reconnect flow — they hold no Game State
  snapshot themselves, only their own `playerId` and `reconnectToken` (see `docs/message-protocol.md`).

## Testing Decisions

- **Seam**: the `Storage` interface behind the Persistence module — tests use an in-memory fake in place of real
  `localStorage`, so no real browser storage is needed.
- Tests should cover:
    - Save → load round-trips the Game State exactly.
    - A `schemaVersion` mismatch is treated as no snapshot present.
    - Declining the resume prompt discards the snapshot (a subsequent load finds nothing).
    - Ending the game clears the snapshot.

## Out of Scope

- Cross-device sync or off-device backup — recovery is scoped to the same Host device/browser only.
- Persisting full Game State for Guests (they only persist their own player ID, per `room-lifecycle`).
- Multiple snapshot history / undo across past sessions — only the single most recent in-progress session is kept.
- Host migration (ADR 0001 — out of scope for the whole project, not just this slice).

## Further Notes

This is intentionally the last and thinnest slice — it depends on the Game State shape settled by `room-lifecycle`,
`round-engine`, and `host-admin` being stable enough to serialize, and adds no new gameplay behavior of its own.
