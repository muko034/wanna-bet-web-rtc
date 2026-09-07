**Blocked by**: 2 (Guest joins a Room)

## What to build

If the Host's connection is gone for good (tab closed, browser crashed), every connected Guest sees a clear
"session ended" state instead of hanging in a disconnected-looking limbo. Per ADR 0001, there is no Host migration —
the Room simply ends.

## Acceptance criteria

- [ ] When the Host's connection is lost and does not recover, every connected Guest is shown a clear "session ended" message.
- [ ] No Guest is left silently stuck on a stale lobby/game screen after the Host disappears.
- [ ] No attempt is made to promote a Guest to a new Host or otherwise continue the session (explicitly out of scope).
