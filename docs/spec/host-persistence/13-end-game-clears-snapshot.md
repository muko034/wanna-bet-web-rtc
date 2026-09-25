**Blocked by**: 11 (Autosave + auto-resume)

## What to build

Introduce the `END_GAME` action (not yet defined in any other spec) so the Host has an explicit way to end a game
session per `docs/game-rules.md`'s Game Ending rules, and wire it to clear the persisted snapshot so a finished game
is never resumed from its link again.

## Acceptance criteria

- [ ] The Host has an explicit "End Game" action available.
- [ ] Triggering "End Game" clears the persisted snapshot for that Room.
- [ ] Opening the Room's link after "End Game" was used does not resume that session.
