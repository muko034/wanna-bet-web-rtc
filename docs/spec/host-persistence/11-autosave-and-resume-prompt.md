**Blocked by**: 1 (Host creates a Room, room-lifecycle), 5 (Single round happy path, round-engine)

**Status**: Implemented

## What to build

A `Storage`-seamed Persistence module that saves the Host's full Game State to `localStorage` on every state change,
from the Room's creation (Lobby included), one snapshot per Room Code. Opening the app on a Room's link resumes that
Room's snapshot automatically — restoring the Game State and the Room Code so Guests can reconnect via the existing
reconnect flow.

## Acceptance criteria

- [x] The Host's Game State is saved automatically (best-effort, non-blocking) after every state-changing action,
      Lobby changes included, with one snapshot per Room Code.
- [x] Opening the app on `/room/<code>` or `/room/<code>/play` when this device holds a snapshot for `<code>` resumes
      it with no prompt: a Lobby snapshot lands on the Lobby, a started game on `/room/<code>/play`.
- [x] Resuming restores the full Game State and the original Room Code.
- [x] While the Room's Transport ID is still held by the previous tab, the Host sees a "Reopening your Room…" screen
      that retries automatically, then an error with a manual Retry.
- [x] A Guest reconnecting after the Host resumes sees their own correct Points/status restored via the standard reconnect flow.
- [x] The `Storage` interface is seamed so tests use an in-memory fake instead of real `localStorage`.
