**Blocked by**: none

## What to build

The core Round Engine reducer and the minimal UI to demo it end-to-end: a Host starts a round with a designated
Active Player; the engine randomly draws a Challenge from the Challenge Bank, excluding anything already in the
Room's Challenge History; the Challenge is hidden on the Active Player's own device; other players (Bettors) place a
Bet (amount + YES/NO Prediction); the Host submits the judged Outcome; the Resolution math from `docs/game-rules.md`
is applied (independent flat, non-zero-sum flows — see `docs/domain-glossary.md`); the Active Player rotates to the
next player afterward.

## Acceptance criteria

- [ ] A round can be started with a designated Active Player and a Challenge randomly drawn from the Challenge Bank
      (no free-text/Host-authored Challenge — see ADR 0004).
- [ ] The drawn Challenge's id is added to the Room's Challenge History, and future draws in the same game exclude
      every id already in that history until the whole bank has been drawn once, at which point it resets.
- [ ] The Challenge text is hidden (shown as a placeholder) on the Active Player's own device while betting is open;
      any Illustration attached to the Challenge is hidden the same way (see ADR 0004).
- [ ] A Bettor can place a Bet with an amount and a YES/NO Prediction.
- [ ] On Outcome YES: YES-predicting Bettors gain their Bet amount, NO-predicting Bettors lose their Bet amount, and the Active Player gains the sum of the NO-predictors' losses.
- [ ] On Outcome NO: NO-predicting Bettors gain their Bet amount, YES-predicting Bettors lose their Bet amount, and the Active Player's Points are unchanged.
- [ ] After Resolution, the Active Player role rotates to the next player in order.
- [ ] The reducer is implemented as a pure function (state + action → new state + payouts) with no I/O, and is covered by tests exercising both Outcome paths directly (no fake/mocks needed for this seam).
