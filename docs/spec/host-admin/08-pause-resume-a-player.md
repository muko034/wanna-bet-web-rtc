**Blocked by**: 5 (Single round happy path, round-engine)

## What to build

Extend the player record with a `status` (`active`/`paused`) and give the Host controls to Pause and Resume any other
player. Paused players are skipped by the Round Engine's rotation and are not required to place a Bet for a round to
resolve.

## Acceptance criteria

- [ ] The Host can pause a specific player from a Host-only control.
- [ ] A paused player is skipped when selecting the next Active Player during rotation.
- [ ] A round resolves without waiting on a paused player's Bet.
- [ ] The Host can resume a paused player, after which they're eligible for rotation and betting again.
- [ ] Paused players are visually distinguished (e.g. grayed out) on the scoreboard for all players.
- [ ] A player's connection dropping (disconnect) does NOT by itself change their status — only an explicit Host action does.
