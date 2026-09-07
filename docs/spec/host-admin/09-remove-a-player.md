**Blocked by**: 8 (Pause/Resume a player)

## What to build

Add a `removed` status and a Host-only control to permanently remove a player. Removed players are excluded from
rotation and betting exactly like paused players, but there is no path back — no "unremove" action exists.

## Acceptance criteria

- [ ] The Host can remove a specific player via a Host-only control.
- [ ] A removed player is skipped by rotation and is not required to place a Bet, identically to a paused player.
- [ ] There is no action or UI path to reverse a removal.
- [ ] Removed players are visually distinguished from active and paused players on the scoreboard.
