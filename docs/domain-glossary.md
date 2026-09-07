# Wanna Bet

A turn-based social betting game played peer-to-peer across devices. Each round, one player attempts a challenge while
the others predict and wager on the outcome.

## Language

**Room**:
A single play session tying one Host and its connected Guests together, identified by a shareable link/code. _Avoid_: Game, session, lobby

**Host**:
The player whose device holds the authoritative Game State for the Room and validates every action. _Avoid_: Server, admin (see Host Admin Action for the moderation-specific sense)

**Guest**:
A player connected to the Host's Room who sends actions and renders from the Host's broadcast state. _Avoid_: Client, peer

**Round**:
One cycle of the game: a Challenge is presented, Bets are placed, the Challenge is resolved, Payouts are applied, and the Active Player rotates. _Avoid_: Turn

**Active Player**:
The player attempting the Challenge in the current Round. Never places a Bet and never sees the Challenge on their own device. _Avoid_: Current player, host (the Active Player is a game role, unrelated to the Host/Guest networking role — the two can be different players)

**Bettor**:
A non-Active Player who places a Bet in the current Round. _Avoid_: Other players, non-active player

**Challenge**:
The task presented to the Active Player for a Round, judged as succeeded or failed. _Avoid_: Task, dare

**Bet**:
A Bettor's wager for a Round: an amount of Points and a Prediction. Capped at `floor(current Points / 2)`, minimum 1. _Avoid_: Wager (when used loosely without amount+Prediction)

**Prediction**:
A Bettor's YES/NO guess on whether the Active Player will succeed at the Challenge. _Avoid_: Guess, call

**Outcome**:
The judged result of a Challenge: YES (succeeded) or NO (failed). _Avoid_: Result (ambiguous with Payout results)

**Resolution**:
The process of applying an Outcome: settling every Bet and adjusting the Active Player's Points. _Avoid_: Settlement

**Payout**:
The Points change applied to one player as a result of Resolution. Payouts are independent per player — a winning Bettor's gain and the Active Player's gain/loss are separate flows, not drawn from each other's losses (the game is **not** zero-sum). _Avoid_: Pool share, pot share (the original rules draft used pool/pot language; that model was superseded — see below)

**Points**:
A player's score. Starts at 100. Floored at 1 — a Bet can never reduce a player to 0, and a player with exactly 1 Point may still Bet their full 1 Point. _Avoid_: Score, chips

**Host Admin Action**:
A moderation action only the Host can take on another player: **Pause** (player is skipped from Bets/rotation until resumed) or **Remove** (player exits the Room permanently). There is no automatic disconnect handling — a disconnected player who hasn't been Paused or Removed is still waited on. _Avoid_: Kick, ban, timeout

## Note on the original game-rules.md draft

`docs/game-rules.md`'s Resolution Rules section describes a pari-mutuel "pool created by NO bets" mechanic. That model
was superseded during design: Payouts are now independent flat flows (not zero-sum), as defined above. The draft doc
still uses pool/pot language and should be updated to match, or explicitly marked superseded, before it's used as a
reference for implementation.
