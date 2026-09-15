**Blocked by**: 15 (Round start and Challenge visibility)

## What to build

A Bet form for Bettors (any connected player who is not the Active Player, and who hasn't already bet this Round):
an amount and a YES/NO Prediction, sent to the Host as a `placeBet` intent (`GuestProtocol.placeBet`, already
defined in `src/protocol/messages.ts`). The Host applies `PLACE_BET` through the reducer and rebroadcasts the
resulting `GameState` so every device can reflect which Bettors have already bet (without revealing the amount or
Prediction of any Bet before Resolution — see `docs/domain-glossary.md`'s Bet/Prediction entries and the
`07-persistent-scoreboard-rank-strip.md` scoreboard rule this shares).

## Acceptance criteria

- [ ] A Bettor's device shows a Bet form (amount + YES/NO) once a Round is open and that player is not the Active
      Player.
- [ ] Submitting the form sends a `placeBet` message to the Host and the form becomes non-interactive/replaced with a
      "bet placed" status on that device, without waiting for the Host's rebroadcast to arrive first if that would
      cause a visible flash (a brief optimistic "submitted" state is acceptable).
- [ ] The Host, on receiving `placeBet`, applies `PLACE_BET` via the reducer and rebroadcasts the updated `GameState`.
- [ ] Every device can tell which Bettors have placed a Bet already (e.g. a checkmark/status), but no device other
      than the Host's authoritative state ever exposes another player's Bet amount or Prediction before Resolution.
- [ ] The Active Player's device does not show a Bet form (enforced by this task's UI; the reducer-level rejection of
      an Active Player's Bet is 06's concern, not this task's).
- [ ] Tests cover: the Bet form appearing only for eligible Bettors, the Host-side handling of an incoming `placeBet`
      message resulting in a reducer call and rebroadcast, and that a per-Bettor "has bet" status is derivable from
      the broadcast `GameState` without leaking amount/Prediction.
