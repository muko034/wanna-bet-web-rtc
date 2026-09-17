# Public state

## Broadcast shared state, derive private views locally

The Host keeps the full authoritative state, but wire messages should carry only the part every device is allowed to know. Do not broadcast private round details such as hidden challenge text or other players' wager details. Each device should combine the shared `GameState` with its own local identity or local session signal to decide what it can show.

This keeps the protocol small and avoids duplicating role-specific state on the wire. It also makes Host and Guest screens easier to reason about, because each screen derives its own private view from one shared broadcast model.

```ts
round: {
  ...roundEngineState.round,
  bets: roundEngineState.round.bets.map((bet) => ({ playerId: bet.playerId })),
}
```
