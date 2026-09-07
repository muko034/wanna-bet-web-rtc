**Blocked by**: 5 (Single round happy path)

## What to build

A persistent scoreboard UI, visible throughout the round (not just after Resolution), showing every player's current
rank and Points — and nothing else. It must never reveal anyone's Bet or Prediction before Resolution.

## Acceptance criteria

- [ ] During an open round (bets not yet resolved), every player sees a scoreboard showing all players' rank and Points.
- [ ] The scoreboard never displays any player's Bet amount or Prediction before Resolution.
- [ ] The current player's own row is visually distinguished (e.g. "(you)").
- [ ] Ranking updates immediately after a Resolution is applied.
