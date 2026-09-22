**Blocked by**: 17 (Host resolves outcome)

## What to build

After the Host submits the Outcome, the game state moves straight on to the next Round (the Active Player has already
rotated). So that nobody misses the Points change, every device shows a result screen from the Resolution that stays
until *that device's own player* taps "Next round" — it does not wait for the Host and does not depend on the Host
starting the next Round.

The result screen follows the prototype's resolved screen:

- Green background for Outcome YES, red for NO.
- Title "<Active Player> succeeded 🎉" or "<Active Player> failed 💥".
- Every player as a row, ranked by current Points: rank, name, "(you)" on the local player's own row, total Points, and
  the Payout delta coloured for gain vs loss. The Active Player's row is labelled "Active player".
- A "Next round" button.

The prototype's per-row "Bet N on YES" line and round-number eyebrow are deliberately **not** included: the Resolution
broadcast carries only Payouts (revealing every Bet after Resolution is a possible follow-up needing a protocol change),
and Game State has no round number.

Because `resolution` leaves the broadcast once the next Round starts, each device keeps the last Resolution it observed
locally until its player dismisses it. Tapping "Next round" shows whatever the game is in by then: the open Round (Bet
screen, or waiting/Hidden for the Active Player).

## Acceptance criteria

- [ ] After a Resolution, every device that observed it shows the result screen with the Outcome, ranked rows with
      "(you)", coloured Payout deltas and the "Active player" label; the background reflects the Outcome.
- [ ] The result screen stays until that device's player taps "Next round"; it is not dismissed by the Host starting
      the next Round.
- [ ] After "Next round": if the next Round is already open the player sees it (Bet screen, or the Active Player's
      waiting view).
- [ ] A device that never observed the Resolution (e.g. joined mid-game) shows no result screen.
- [ ] No Bet amount or Prediction beyond the Payout deltas is shown, and no wire-protocol change is made.
- [ ] Row ranking (including ties), "(you)"/"Active player" labelling and delta signs come from a pure resolver with
      unit tests; the dismiss/cache behaviour is covered by tests at the resolver level.
- [ ] Styles the result screen needs are ported from the prototype into the app's stylesheet, without inline styles.
