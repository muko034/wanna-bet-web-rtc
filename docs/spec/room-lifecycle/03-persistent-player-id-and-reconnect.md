**Blocked by**: 2 (Guest joins a Room)

## What to build

Each Guest is assigned two identifiers on first join, both stored in that Guest's own `localStorage`: a public
`playerId` (safe to broadcast — appears in every `state` snapshot for rotation/scoreboard/Bet-attribution) and a private
`reconnectToken` (a secret, delivered once via a dedicated `welcome` message and never rebroadcast — see
`docs/message-protocol.md` and ADR 0003). A reconnecting Guest (dropped connection or page reload) presents its
`reconnectToken`, not its `playerId`, so the Host can match it back to the existing player record without exposing
anything an eavesdropper could use to impersonate that player. The Host also tracks and surfaces each player's live
connection status (connected/disconnected), independent of this identity matching.

## Acceptance criteria

- [ ] A Guest is assigned a public `playerId` and a private `reconnectToken` on first join, both stored in their own
  browser's `localStorage`.
- [ ] Reloading the Guest's page and rejoining via the same link, presenting the stored `reconnectToken`, reconnects
  them to their same existing player record (same name, no duplicate player created).
- [ ] The `reconnectToken` never appears in any `state` broadcast, to its own owner or anyone else — only in the
  one-time `welcome` reply to the connection that generated it.
- [ ] The Host's view reflects each player's live connection status (connected vs. disconnected).
- [ ] A Guest whose connection drops and later reconnects is matched by their `reconnectToken`, not by name or by their
  public `playerId`.
