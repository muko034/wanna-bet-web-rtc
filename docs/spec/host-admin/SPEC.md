## Problem Statement

A round can get stuck waiting on a player who's gone quiet — disconnected, stepped away, or being disruptive — and
there's no automatic timeout by design (a deliberate choice for this casual, friend-group game). The Host needs a way
to actively manage that player so the game can keep moving, without the app silently guessing what to do on their
behalf.

## Solution

Extend the Game State with a per-player **status** (`active`, `paused`, or `removed`) that only the Host can change,
via explicit Pause/Resume/Remove actions. The `round-engine` slice's rotation and bet-eligibility logic is extended to
skip non-`active` players, using the eligibility-predicate seam that slice already exposes for this purpose.

## User Stories

1. As the Host, I want to pause a specific player, so that a round stops waiting on their Bet and rotation skips them, without kicking them out entirely.
2. As the Host, I want to resume a paused player, so that they rejoin betting and rotation once they're back.
3. As the Host, I want to remove a player permanently, so that they're excluded from all future rounds (e.g. they've left for good).
4. As any player, I want a paused or removed player visually distinguished on the scoreboard (e.g. grayed out or labeled), so that I understand why they're not being waited on.
5. As a Bettor, I want a round to resolve without waiting on a paused or removed player's Bet, so that the game isn't stuck.
6. As any player, I want the Active Player role to skip over paused/removed players during rotation, so that they're never selected to face a Challenge while paused/removed.
7. As the Host, I want a round in progress to be safely aborted (with no Points changed) if I remove the current Active Player mid-round, so that an incomplete round doesn't produce a nonsensical Resolution.
8. As a Bettor, I want my already-placed Bet discarded without any Points change if I'm removed mid-round, so that a partial round still resolves cleanly for everyone else.
9. As the Host, I want disconnection alone to never change a player's status, so that the game keeps waiting on a silently-dropped connection until I make an explicit decision (matches the "no automatic disconnect handling" design decision).

## Implementation Decisions

- **Player schema extension**: add `status: 'active' | 'paused' | 'removed'` to the player record defined in the `round-engine` slice (default `active` on join).
- **New actions** (Host-only, but validated only by the fact that only the Host process ever runs the reducer): `PAUSE_PLAYER(playerId)`, `RESUME_PLAYER(playerId)`, `REMOVE_PLAYER(playerId)`.
- **Rotation/eligibility integration**: the `round-engine` slice's eligibility predicate (defined as an extension seam in that spec) is implemented here as "player status is `active`." Paused and removed players are both ineligible for rotation and Bet participation; the distinction between them is only about whether they can be resumed later.
- **Mid-round removal of the Active Player**: cancels the in-progress round with no Payouts applied; rotation immediately advances to the next eligible player and a new round begins.
- **Mid-round removal of a Bettor**: their pending Bet (if any) for that round is discarded with no Payout; Resolution proceeds normally using the remaining Bets.
- **Removal is permanent** in this slice: a removed player cannot be un-removed (no distinct "unremove" action) — only Pause/Resume is reversible. If this turns out to be too strict in practice, revisit in a follow-up slice rather than silently allowing it here.

## Testing Decisions

- **Seam**: the same pure reducer seam as `round-engine` (this slice only adds actions and an eligibility predicate to that module) — no networking or storage involved, tested directly on the reducer.
- Tests should cover:
  - Pause → excluded from rotation/betting; Resume → included again.
  - Remove → excluded permanently; no resume path.
  - Mid-round Active Player removal aborts the round with no Points changes.
  - Mid-round Bettor removal discards their Bet only, Resolution proceeds for everyone else.
  - A disconnect event (from `room-lifecycle`) alone never changes `status`.

## Out of Scope

- Automatic disconnect timeout/auto-pause (explicitly rejected during design — may be reconsidered later, but not in this slice).
- Un-removing a player.
- Audit log / history of admin actions.
- Banning by name or device beyond the current session's player record.
- Networking/connection-status detection itself (`room-lifecycle` slice's concern — this slice only reacts to status, it doesn't detect disconnects).

## Further Notes

This slice is blocked by `round-engine` (it needs the eligibility-predicate extension point and player schema to
exist first) but not by `room-lifecycle` or `host-persistence`.
