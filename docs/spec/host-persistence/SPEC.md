## Problem Statement

The Host's browser tab is the only copy of the Game State (per ADR 0001 — no backend, no database). An accidental reload
or crash of that one tab would otherwise destroy the entire in-progress game for everyone, with no way to recover.

## Solution

The Host serializes the full Game State to its own `localStorage` on every state change, from the moment the Room is
created (Lobby included). When the app is opened on a Room's link (`/room/<code>` or `/room/<code>/play`) and this
device holds a snapshot for that Room, the Host's session is resumed automatically — restoring the Game State and Room
identifier so Guests can reconnect via the standard `room-lifecycle` reconnect flow.

## User Stories

1. As the Host, I want my Game State saved automatically as the game progresses, so that an accidental reload doesn't
   lose the whole session.
2. As the Host, I want my session resumed automatically when I reopen my Room's link, so that I can recover from a
   reload or crash without any extra step.
3. As the Host, I want the resumed session to keep the same Room link/code as before, so that Guests can reconnect
   without a new link being distributed.
4. As the Host, I want each Room I host to be saved separately, so that starting a new Room never wipes out another
   Room's unfinished session.
5. As a Guest, after the Host resumes a session, I want to reconnect via the normal reconnect flow and see my own
   correct Points/status restored, so that the recovery is invisible to me beyond a brief reconnect.
6. As the Host, I want an old or incompatible snapshot (e.g. from a previous app version) to be detected and discarded
   rather than crashing the app, so that a stale save never blocks me from starting a new game.
7. As the Host, I want the snapshot cleared once I explicitly end the game, so that a finished game's link never
   resumes it later.

## Implementation Decisions

- **Persistence module**: a `save(state)` / `load(code)` pair behind a `Storage` seam wrapping `localStorage`, keyed by
  Room Code — one snapshot per Room, so several Rooms hosted on the same device never overwrite each other.
- **Save trigger**: every Game State mutation — Lobby changes from the Room's creation onward, plus `round-engine` and
  `host-admin` actions — triggers a save, best-effort and non-blocking — gameplay is never delayed waiting on the write.
- **Snapshot contents**: wraps the canonical `GameState` shape (see `docs/message-protocol.md` and ADR 0003) as
  `{ schemaVersion, savedAt, state }` — players (including `status` from `host-admin`), round/rotation state, Points —
  plus the Room id/code so Guests reconnect to the same identifier, and the Host-private state needed to pick the game
  back up: the unredacted Round Engine state and the `reconnectToken` → `playerId` map, so returning Guests `rejoin` as
  themselves.
- **Auto-resume**: checked once, against the URL the app was opened on. If it is `/room/<code>` or `/room/<code>/play`
  and a snapshot exists for `<code>`, the Host reclaims the Room's original Transport ID and restores the snapshot — a
  Lobby snapshot lands on the Lobby, a started game on `/room/<code>/play`. There is no "resume?" prompt: opening the
  Room's link is the intent to resume.
- **Reclaiming the Room Code**: right after a crash the signalling server may still hold the previous tab's Transport ID
  (until its heartbeat times out). While the ID is taken, the Host sees a "Reopening your Room…" screen that retries
  automatically; if it is still taken after about a minute, or any other error occurs, an error with a manual Retry is
  shown.
- **Schema versioning**: snapshots include a `schemaVersion` field; on load, a mismatched version is treated as absent
  (discarded), never partially applied.
- **Staleness**: snapshots include a `ttl` field — an absolute expiry timestamp set to `now + 24h` on every save (not
  just the first). On load, a snapshot whose `ttl` has passed is treated as absent (discarded), same as a
  `schemaVersion` mismatch. A stale snapshot's Room Code may since have been taken by another Host's Room; discarding
  it must not stop this device from joining that Room as a Guest.
- **Snapshot lifecycle**: cleared on explicit "end game" (per `game-rules.md`'s Game Ending rules), and discarded once
  stale or incompatible.
- Guests are unaffected by this slice beyond the existing `room-lifecycle` reconnect flow — they hold no Game State
  snapshot themselves, only their own `playerId` and `reconnectToken` (see `docs/message-protocol.md`).

## Testing Decisions

- **Seam**: the `Storage` interface behind the Persistence module — tests use an in-memory fake in place of real
  `localStorage`, so no real browser storage is needed.
- Tests should cover:
    - Save → load round-trips the Game State exactly.
    - A `schemaVersion` mismatch is treated as no snapshot present.
    - An expired `ttl` is treated as no snapshot present.
    - Every save refreshes `ttl` to `now + 24h`, not just the first.
    - Saving one Room's snapshot leaves other Rooms' snapshots intact.
    - Ending the game clears the snapshot.

## Out of Scope

- Cross-device sync or off-device backup — recovery is scoped to the same Host device/browser only.
- Persisting full Game State for Guests (they only persist their own player ID, per `room-lifecycle`).
- Snapshot history / undo — only the latest snapshot of each Room is kept.
- A list of saved Rooms on the Home screen — the Room's link is the way back into it.
- Host migration (ADR 0001 — out of scope for the whole project, not just this slice).

## Further Notes

This is intentionally the last and thinnest slice — it depends on the Game State shape settled by `room-lifecycle`,
`round-engine`, and `host-admin` being stable enough to serialize, and adds no new gameplay behavior of its own.
