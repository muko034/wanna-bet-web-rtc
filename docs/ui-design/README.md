# Wanna Bet — UI prototype (THROWAWAY)

> Plan: A single mobile-first design ("Big State") for the full
> create-room → join-room → play-game flow, on a standalone throwaway page
> (no existing app to host this in yet, so sub-shape B). Each player has
> their OWN phone and only ever sees their OWN bet — never anyone else's —
> until the round resolves and everything is revealed at once.

**This is prototype code.** No tests, no error handling beyond making it
runnable, no persistence (state resets on reload), no real backend/network.
There's only one shared in-memory game state (simulating a server); a
**"📱 Simulate device" bar** at the top lets you preview any player's own
phone — that bar is prototype-only tooling, not part of the real design.

## Run it

Just open the file, no build step:

```
open index.html
```

(or double-click it / drag into a browser tab)

## Design — "Big State"

Full-bleed color-block screens, giant type, giant tap zones: one dominant
idea fills the whole phone screen at a time instead of small cards/toggles.

Use the **"📱 Simulate device"** bar at the top to flip between whose phone
you're looking at (host / challenger / other players) — each one only
ever shows its own bet, exactly like real separate devices would.

### Final corrections applied

- **Persistent Leaderboard.** On every in-game screen except the result
  screen, a rank badge (`#2 · 120 pts`, with a medal for ranks 1–3) sits in
  the top bar. Tapping it opens a bottom sheet listing every player's rank
  and points ("(you)" highlighted; equal points share a rank; paused players
  dimmed and labelled; removed players hidden). It never reveals anyone's
  bet — only point totals — so you always know your placement mid-game.
- **Result screen auto-dismisses.** It leaves by itself after 5 seconds;
  "Next round" still dismisses it early.
- **Challenger never sees the challenge.** On the challenger's own
  device, the challenge text is replaced with a "🙈 Hidden from you"
  placeholder while waiting for bets, and with a generic "Judge yourself
  honestly" prompt at resolution time — the challenge itself is assumed to
  be communicated out loud/out-of-band by the group, not shown on-screen.
- **Challenge shown as a card.** For betting (Bettor) players, the
  challenge now lives in its own frosted "task card" (label + text) that
  sits visually apart from the giant background type, both while placing a
  bet and while waiting for the result.

## Verdict

- Winner: **Big State** (variant B) — chosen by the user; the other two
  explored variants (Card Wizard, Chat Feed) were removed from this file.

## Capture

Once the design is validated, fold this layout into the real app, then
move this whole prototype folder to a throwaway branch (not main) and link
that branch from the implementation issue.
