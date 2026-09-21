**Blocked by**: 16 (Bettor places a Bet)

## What to build

Bring the Bettor's Bet screen in line with the validated "Big State" prototype (see the UI design README): the Challenge
card, big YES/NO tap zones instead of radio buttons, a slider for the amount, and a "Lock in bet" action, all on the
orange betting background. Once locked, the Bettor sees a "Locked in" confirmation with their own Bet, plus the public
per-Bettor "has bet" status from 16.

The amount slider runs from 1 to `max(1, floor(current Points / 2))` and shows "Max N · you have M pts". Enforcement of
the cap in the engine is spec 06's concern — here it is UI-only, but the cap lives in one small pure helper so 06 can
reuse it instead of re-deriving it.

Prototype-only tooling (device switcher, simulated bots) is not part of this work.

## Acceptance criteria

- [ ] A Bettor sees the Challenge card, YES and NO tap zones, an amount slider, and a "Lock in bet" button on the
      betting background while a Round is open and they have not yet bet.
- [ ] No Prediction is selected by default; "Lock in bet" is disabled until YES or NO has been chosen. The chosen tap
      zone is visibly marked.
- [ ] The slider's minimum is 1 and its maximum is `max(1, floor(current Points / 2))` (a player with exactly 1 Point
      can still bet 1); the current value, "Max N" and the player's Points are shown. The default amount is 1.
- [ ] Locking in sends the same `placeBet` as before and swaps the screen for a "Locked in" confirmation showing the
      player's own amount and Prediction and how many Bettors have yet to bet, with the per-Bettor status list from 16
      still visible. No other player's Bet amount or Prediction is ever shown.
- [ ] The Active Player's screen still has no Bet form.
- [ ] The Bet cap is computed by a single pure helper, and the screen's branching (which panel, which background) is
      resolved in a pure resolver per `docs/conventions/view-resolvers.md`; both have unit tests, including the
      1-Point exception and odd-Points rounding.
- [ ] Styles this screen needs are ported from the prototype into the app's stylesheet; the Bet form no longer relies on
      inline styles.
