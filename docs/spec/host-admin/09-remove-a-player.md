**Blocked by**: 8 (Pause/Resume a player)

## What to build

Add a `removed` status and a Host-only control to permanently remove a player. Removed players are excluded from
rotation and betting exactly like paused players, but there is no path back — no "unremove" action exists. A player's
own Leave (see `docs/domain-glossary.md`) is a self-triggered alias for this same reducer logic — same
`removed` outcome, same mid-round edge-case handling (see spec 10) — but is not a Host Admin Action, since the Host
didn't initiate it.

## Acceptance criteria

- [ ] The Host can remove a specific player via a Host-only control.
- [ ] A player can remove themself via Leave, with an identical outcome to a Host-initiated Remove.
- [ ] A removed player (whether Host-removed or self-Left) is skipped by rotation and is not required to place a Bet,
  identically to a paused player.
- [ ] There is no action or UI path to reverse a removal, regardless of whether it was Host-initiated or a self-Leave.
- [ ] Removed players are visually distinguished from active and paused players on the scoreboard.
