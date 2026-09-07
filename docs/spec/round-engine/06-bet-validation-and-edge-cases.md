**Blocked by**: 5 (Single round happy path)

## What to build

Full Bet validation on top of the happy-path round loop: the half-of-Points cap (rounded down), the minimum Bet of 1,
the explicit exception letting a player with exactly 1 Point still bet that full 1 Point, integer-only amounts, one
Bet per player per round, and a hard block on the Active Player attempting to place a Bet.

## Acceptance criteria

- [ ] A Bet above `floor(current Points / 2)` is rejected, except when the player has exactly 1 Point (they may bet that full 1 Point).
- [ ] A Bet below 1, a non-integer Bet, or a zero/negative Bet is rejected.
- [ ] A player attempting to place a second Bet in the same round is rejected.
- [ ] The Active Player attempting to place a Bet is rejected.
- [ ] No sequence of Bets and Resolutions can ever reduce a player's Points below 1.
- [ ] Tests cover each boundary directly against the reducer (odd Points cap rounding, the 1-point exception, double-bet rejection, Active Player rejection).
