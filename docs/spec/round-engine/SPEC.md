## Problem Statement

Once a Room exists, the group needs to actually play "Wanna Bet": present a Challenge to the Active Player, collect
Bets from everyone else, resolve the Outcome fairly, and update everyone's Points — repeatedly, round after round —
without arguments about the math or the rules.

## Solution

A pure **Round Engine** module owns the Game State (players, Points, Active Player, current round phase, Bets) and
evolves it only in response to explicit actions (start a round, place a Bet, resolve the Outcome). It applies the
resolution math and rotation rules exactly as defined in `docs/game-rules.md`, entirely Host-side — Guests only ever
send intents and render whatever state the Host broadcasts.

## User Stories

1. As the Active Player, I want the Challenge text hidden on my own device while betting is open, so that I can't be influenced by seeing it described in text.
2. As a Bettor, I want to see the Challenge presented in its own card, so that I know what I'm predicting on.
3. As a Bettor, I want to place a Bet with an amount and a YES/NO Prediction, so that I participate in the round.
4. As a Bettor, I want my Bet amount capped at `floor(my current Points / 2)`, with a minimum of 1, so that the betting-rules constraint from `game-rules.md` is enforced automatically.
5. As a Bettor with exactly 1 Point, I want to still be able to bet my full 1 Point (the explicit exception to the half-cap), so that I'm never locked out of playing.
6. As a Bettor, I want to be prevented from placing more than one Bet per round, so that the round resolves predictably.
7. As the Active Player, I want to be prevented from placing a Bet, so that the rule "the active player does not place a bet" is enforced, not just assumed by the UI.
8. As the Host, I want to submit the judged Outcome (YES/NO) once bets close, so that the round can be resolved (challenge judging itself is a human, out-of-band decision — see Out of Scope).
9. As a Bettor who predicted correctly, I want to gain my Bet amount in Points, so that I'm rewarded for a correct Prediction.
10. As a Bettor who predicted incorrectly, I want to lose my Bet amount in Points, so that incorrect Predictions carry real risk.
11. As the Active Player, when the Outcome is YES, I want to gain the sum of what the NO-predicting Bettors lost, so that succeeding at the Challenge is rewarded.
12. As the Active Player, when the Outcome is NO, I want my Points to remain unchanged, so that failing the Challenge doesn't directly cost me Points beyond not gaining any.
13. As any player, I want it guaranteed my Points can never drop below 1 as a result of a Bet, so that I can never be mathematically eliminated from the game.
14. As any player, I want the Active Player role to rotate to the next eligible player after every Resolution, so that everyone gets a turn.
15. As any player, I want a persistent scoreboard visible during the round (rank + Points only, never anyone's Bet), so that I always know my standing without any Bet being spoiled early.
16. As any player, I want every broadcast state update tagged with an increasing sequence number, so that a stale/out-of-order update can never overwrite a newer one on my screen.
17. As the Host, I want the Challenge text to be free-form text I type in, so that the group can invent any task on the fly without the app constraining or validating it.

## Implementation Decisions

- **Game State shape** (conceptual, not final types):
  - `players`: list of `{ playerId, name, points, order }` (`status` field added by the `host-admin` slice — this slice treats all connected players as eligible).
  - `round`: `{ activePlayerId, phase: 'awaiting-bets' | 'resolved', bets: Map<playerId, { amount, prediction }> }`.
- **Actions** (the only Game-State mutations in this slice): `START_ROUND`, `PLACE_BET(playerId, amount, prediction)`, `RESOLVE_ROUND(outcome)`. All Host-side; Guests only ever send intents (`place-bet`), never mutate state directly.
- **Resolution math**, applied exactly per `game-rules.md`:
  - Outcome YES: YES-predictors gain their Bet; NO-predictors lose their Bet; Active Player gains the sum of NO-predictors' losses.
  - Outcome NO: NO-predictors gain their Bet; YES-predictors lose their Bet; Active Player's Points unchanged.
  - These are independent flat flows, not a shared pool — the economy is not zero-sum (see `docs/domain-glossary.md`).
- **Bet validation**: integer amounts only; minimum 1; cap `floor(points / 2)`, except a player with exactly 1 point may bet that 1 point; one Bet per player per round; Active Player is rejected if they attempt to Bet.
- **Rotation**: baseline rule in this slice is "advance to the next player in `order`, wrapping around." The `host-admin` slice extends this to skip paused/removed players — this slice's rotation function should take an eligibility predicate as a seam for that extension, rather than hard-coding "all players are eligible."
- **Reducer shape**: a pure function `(state, action) -> { state, payouts }` — no I/O, no networking, no timers. This is the module's core seam (see Testing Decisions).
- Every broadcast `state` message carries the `seq` field defined in the `room-lifecycle` slice's message envelope; this slice is responsible for incrementing it on every state change.

## Testing Decisions

- **Seam**: the reducer function itself — pure input (state + action) to output (new state + payouts), with no I/O. This is the highest and only seam needed for this slice; no fakes or doubles required.
- Tests should be table-driven over representative states/actions, covering:
  - Resolution math for both Outcomes, including the Active Player's asymmetric treatment (gain on YES, no-change on NO).
  - Bet validation boundaries: 1-point exception, cap rounding (odd Points), rejecting non-integer/zero/negative amounts, rejecting a second Bet, rejecting the Active Player's Bet.
  - Rotation order, including wraparound.
  - The 1-point floor: no sequence of Bets/Resolutions should ever be able to drive a player below 1 Point.
- Only external behavior (inputs/outputs of the reducer) is tested — no assertions on internal state representation beyond what's part of the documented shape.

## Out of Scope

- Automated challenge judging (image/sensor detection, timers) — the Outcome is always a manual Host input.
- Player status / pause / remove (`host-admin` slice) — this slice only defines the eligibility-predicate seam for that slice to extend.
- Networking/transport and Room/connection concerns (`room-lifecycle` slice).
- Persisting Game State across a Host reload (`host-persistence` slice).
- Visual design beyond the behaviors described above (see `docs/ui-design/index.html` / README for the validated screens).

## Further Notes

This slice has no dependency on `room-lifecycle` to be built or tested — the reducer is pure and can be fully verified
in isolation. Integration with real networking happens by having `room-lifecycle` call this module's reducer on
incoming Guest intents and broadcast the resulting state.
