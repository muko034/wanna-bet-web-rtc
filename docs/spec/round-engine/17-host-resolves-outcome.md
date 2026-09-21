**Blocked by**: 16 (Bettor places a Bet)

**Status**: Implemented

## What to build

A Host-only Outcome control (YES/NO) that closes betting and drives `RESOLVE_ROUND` through the reducer, applying
Payouts and rotating the Active Player, then broadcasting the resulting `GameState`. Every device renders the
Resolution's outcome and the resulting Points changes before returning to the "no Round open" state, ready for the
next Active Player to start a new Round (looping back to task 15's Round-start control).

## Acceptance criteria

- [x] Only the Host's device shows the Outcome (YES/NO) control, and only once all Bettors have bet (see 19).
- [x] Submitting an Outcome runs `RESOLVE_ROUND` via the reducer, producing Payouts and a rotated Active Player, and
      broadcasts the resulting `GameState`.
- [x] Every device shows the Resolution's result (at least: the Outcome and each visible player's resulting Points
      change) before the Round closes.
- [x] After Resolution, the new Active Player can start the next Round from the same Host control used in 15 — this
      task closes the loop into a fully repeatable, real (not simulated) multi-Round game across real devices.
- [x] Tests cover: the Host-side handling of an Outcome submission resulting in a `RESOLVE_ROUND` reducer call and
      rebroadcast, and that the broadcast `GameState` reflects the rotated Active Player and updated Points for both
      Outcome paths (YES/NO), reusing the reducer-level math already proven in `05`'s test suite rather than
      re-deriving it at this layer.
