**Blocked by**: 9 (Remove a player)

## What to build

Correct handling for removal happening mid-round, for both possible roles of the removed player. Applies identically
whether the removal was Host-initiated or a player's own Leave (see spec 09) — both drive the same reducer logic.

## Acceptance criteria

- [ ] Removing the current Active Player mid-round (Host-initiated or self-Leave) cancels that round with no Payouts
  applied, and rotation immediately advances to the next eligible player to begin a new round.
- [ ] Removing a Bettor mid-round (Host-initiated or self-Leave) discards only their pending Bet (no Payout for it);
  Resolution proceeds normally using the remaining Bettors' Bets.
- [ ] Tests cover both removal-during-a-round scenarios directly against the reducer, for both trigger sources.
