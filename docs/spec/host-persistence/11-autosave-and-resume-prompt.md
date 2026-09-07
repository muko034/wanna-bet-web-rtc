**Blocked by**: 1 (Host creates a Room, room-lifecycle), 5 (Single round happy path, round-engine)

## What to build

A `Storage`-seamed Persistence module that saves the Host's full Game State to `localStorage` on every state change,
keyed by Room id, and offers to resume a matching in-progress snapshot when the app is reopened — restoring the Game
State and the Room id so Guests can reconnect via the existing reconnect flow.

## Acceptance criteria

- [ ] The Host's Game State is saved automatically (best-effort, non-blocking) after every state-changing action.
- [ ] Reopening the app when a matching in-progress snapshot exists offers the Host a "resume this session?" prompt.
- [ ] Accepting the prompt restores the full Game State and the original Room id/code.
- [ ] A Guest reconnecting after the Host resumes sees their own correct Points/status restored via the standard reconnect flow.
- [ ] The `Storage` interface is seamed so tests use an in-memory fake instead of real `localStorage`.
