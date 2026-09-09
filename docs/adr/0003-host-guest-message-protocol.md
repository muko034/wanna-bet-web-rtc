# Full-snapshot, single-message Host↔Guest protocol with split public/private identity

We chose a Host↔Guest message protocol built on **one unified `state` snapshot** (not per-concern broadcasts, not
deltas/patches) sent identically to every Guest after any change, plus a **small, fixed set of action messages**
(`join`, `rejoin`, `placeBet`, `leave`) — Host-only actions (start round, submit outcome, Pause/Remove) are never wire
messages, since their effects simply appear in the next snapshot. Full details live in `docs/message-protocol.md`.

We considered splitting broadcasts by concern (`roomState`/`roundState`/`adminState`) for smaller payloads, but at 2-20
players this reintroduces exactly the coordination bug full-snapshot broadcasting avoids: independently-ordered streams
that can disagree with each other (e.g. `adminState` says a player was removed while a stale `roundState`
still shows them as an active Bettor). One snapshot, one `seq` (Host-owned, monotonic — safe by construction since the
Host is the sole writer), matches ADR 0001's "single authoritative Game State" and needs no reconciliation logic.

We also identified and closed an impersonation gap: a single `playerId` cannot double as both the public identifier
shown in every broadcast (needed for rotation/scoreboard/Bet-attribution) and the private credential used to reclaim a
seat on reconnect — broadcasting it to everyone hands every Guest the exact secret needed to impersonate any other
player. We split this into a public `playerId` (safe to expose) and a private `reconnectToken` (generated at `join`,
delivered exactly once via a dedicated `welcome` message to its owner only, never rebroadcast). The Host binds each live
connection to a `reconnectToken` in memory at handshake time, so action messages carry no identity field at all and
post-handshake impersonation is structurally impossible, not just discouraged.

The wire `state` payload and the `localStorage` persistence snapshot share one canonical `GameState` TypeScript type,
per ADR 0002's grouping of the message protocol and the state-snapshot schema as the same class of typed-contract risk.

## Consequences

- `leave` reuses the same remove logic as Host-initiated Remove (host-admin spec), which required amending that spec's
  "only an explicit Host action" wording to include the player's own Leave.
- No protocol version field and no room-join PIN were deliberately left out of scope — both are cheap to add later if
  this project's trust model (small, trusted friend group, per ADR 0001) ever changes.
