**Blocked by**: 18 (Bettor bet screen in Big State style)

## What to build

The Host's Outcome control appears only once every Bettor has placed a Bet, matching `game-rules.md` ("after all bets
are placed, the challenge is resolved") and the prototype's judging screen. Until then everyone sees an appropriate
waiting state.

- **Host, once all Bets are in:** a judging screen on the dark judge background asking "Did <Active Player> pull it
  off?" with ✅ Success (Outcome YES) and ❌ Fail (Outcome NO) tap zones. This replaces the current always-visible
  "Outcome: YES/NO" buttons.
- **Everyone else:** unchanged from 18 (their own Bet screen, then the "Locked in" confirmation).

If a Bettor never bets (e.g. a dropped connection), the round waits — the Host's way out is Pause or Remove from the
`host-admin` slice, exactly as `game-rules.md` describes.

## Acceptance criteria

- [x] The Host's Outcome control is not shown while any Bettor has yet to bet, and appears as soon as the last Bet is
      in; it is never shown on a non-Host device.
- [x] The judging screen's Success / Fail tap zones submit Outcome YES / NO through the existing Resolution flow from
      17.
- [x] When the Host is also the Active Player or a Bettor, the Host's screen still behaves correctly (a Host who is a
      Bettor sees their own Bet screen first, then the judging screen once everyone has bet).
- [x] Which control/background/copy each role sees is resolved in a pure resolver with unit tests covering Host vs
      non-Host, Active Player vs Bettor, and all-bets-in vs not.
- [x] Spec 17's acceptance criteria are amended to say the Outcome control appears once all Bettors have bet (rather
      than as soon as a Round is open).
