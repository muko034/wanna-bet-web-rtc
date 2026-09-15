**Blocked by**: none

**Status**: Reducer done (commit `ae3c21e`) and merged into this scope. The UI/networking half originally implied by
this task's "minimal UI to demo it end-to-end" prose turned out to require real Host↔Guest wiring (Room/Player model
changes, broadcast/receive plumbing, per-role rendering) — bigger than a "minimal demo." That work has been split out
into its own vertical-slice tasks: `14-game-state-reaches-guest.md`, `15-round-start-and-challenge-visibility.md`,
`16-bettor-places-a-bet.md`, `17-host-resolves-outcome.md`. This task (`05`) is now scoped to the reducer only, which
is complete; nothing further is expected here.

## What to build

The core Round Engine reducer: a Host starts a round with a designated Active Player; the engine randomly draws a
Challenge from the Challenge Bank, excluding anything already in the Room's Challenge History; other players
(Bettors) place a Bet (amount + YES/NO Prediction); the Host submits the judged Outcome; the Resolution math from
`docs/game-rules.md` is applied (independent flat, non-zero-sum flows — see `docs/domain-glossary.md`); the Active
Player rotates to the next player afterward.

## Acceptance criteria

- [x] A round can be started with a designated Active Player and a Challenge randomly drawn from the Challenge Bank
      (no free-text/Host-authored Challenge — see ADR 0004).
- [x] The drawn Challenge's id is added to the Room's Challenge History, and future draws in the same game exclude
      every id already in that history until the whole bank has been drawn once, at which point it resets.
- [x] A Bettor can place a Bet with an amount and a YES/NO Prediction.
- [x] On Outcome YES: YES-predicting Bettors gain their Bet amount, NO-predicting Bettors lose their Bet amount, and the Active Player gains the sum of the NO-predictors' losses.
- [x] On Outcome NO: NO-predicting Bettors gain their Bet amount, YES-predicting Bettors lose their Bet amount, and the Active Player's Points are unchanged.
- [x] After Resolution, the Active Player role rotates to the next player in order.
- [x] The reducer is implemented as a pure function (state + action → new state + payouts) with no I/O, and is covered by tests exercising both Outcome paths directly (no fake/mocks needed for this seam).
