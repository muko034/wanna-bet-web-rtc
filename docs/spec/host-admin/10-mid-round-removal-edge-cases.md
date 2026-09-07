**Blocked by**: 9 (Remove a player)

## What to build

Correct handling for removal happening mid-round, for both possible roles of the removed player.

## Acceptance criteria

- [ ] Removing the current Active Player mid-round cancels that round with no Payouts applied, and rotation immediately advances to the next eligible player to begin a new round.
- [ ] Removing a Bettor mid-round discards only their pending Bet (no Payout for it); Resolution proceeds normally using the remaining Bettors' Bets.
- [ ] Tests cover both removal-during-a-round scenarios directly against the reducer.
