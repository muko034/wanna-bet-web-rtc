# Host↔Guest Message Protocol

The Host↔Guest data channel (see ADR 0001) carries a small, fixed set of JSON messages. There is no traditional
request/response correlation on the transport — see [Delivery model](#delivery-model) below — so every message type
below is self-contained.

This document is the wire-level reference. See ADR 0003 for the reasoning behind its shape, `domain-glossary.md` for
game vocabulary, and the `spec/` slices for behavior.

## Envelope

Every message is `{ type, seq, payload }`.

- `type`: string discriminator, one of the message types below.
- `seq`: monotonically increasing integer, set by the Host on every message *it* sends. Guest-sent messages omit it
  (only the Host needs to detect stale/out-of-order delivery, e.g. across a reconnect race).
- `payload`: type-specific fields, described per message below.

## Delivery model

A WebRTC data channel (via PeerJS) is an ordered, reliable, point-to-point stream between the Host and exactly one
Guest — there's no built-in request/reply pairing and no broadcast primitive. "Broadcasting" means the Host loops over
every open connection and sends the same message to each; the Host can just as easily send a *different* message to one
specific connection (used by `welcome` and `rejected` below).

## Identity model

Two separate identifiers exist per player — conflating them would let any Guest impersonate any other (see ADR 0003):

- **`playerId`** (public): included in every `state` broadcast. Safe to expose — used for rotation
  and Bet attribution. Knowing it grants no privilege.
- **`reconnectToken`** (private secret): generated once at `join`, delivered only via `welcome` to its owner, and never
  included in any broadcast message. Stored client-side (e.g. `localStorage`) and presented only in `rejoin`.

The Host binds each live connection to a `reconnectToken` in memory at handshake time. Every later message from that
connection (`placeBet`, `leave`) carries no identity field at all — the Host derives the actor from the connection
itself, so impersonation after the handshake is structurally impossible, not just discouraged.

Room access control is the shareable link/`peerId` alone (per ADR 0001) — no separate join PIN.

## Messages

### Guest → Host

| type       | payload                  | notes                                                                                                                                 |
|------------|--------------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| `join`     | `{ name }`               | Sent once, as the first message on a fresh connection, when the Guest has no stored `reconnectToken`.                                 |
| `rejoin`   | `{ reconnectToken }`     | Sent once, as the first message on a fresh connection, when the Guest has a stored `reconnectToken` from a prior session.             |
| `placeBet` | `{ amount, prediction, challengeId }` | Actor derived from the connection binding. `challengeId` is the Challenge the Bettor saw when betting. Confirmed only by a `state` showing the Bet; refused with `rejected` (`action: 'placeBet'`), including `STALE_CHALLENGE` when `challengeId` no longer matches the Round's Challenge. |
| `leave`    | `{}`                     | Self-triggered alias for the same remove logic as a Host-initiated Remove (see ADR 0003) — actor derived from the connection binding. Mid-game it also drops the Guest's Bet and, if the Guest was the Challenger, starts a new Round for the next Challenger. |

### Host → one Guest

| type       | payload                        | notes                                                                                                                                                                                                                     |
|------------|--------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `welcome`  | `{ playerId, reconnectToken }` | Sent once, immediately after a successful `join`/`rejoin`, only to that connection. The one and only time `reconnectToken` is transmitted.                                                                                |
| `rejected` | `{ reason, action }`           | Sent only to the Guest whose action was rejected. `action` echoes the offending message's `type` for the Guest's own error handling. `reason` is an extensible string enum (e.g. `INVALID_BET_AMOUNT`, `UNKNOWN_PLAYER`, `STALE_CHALLENGE`). |

### Host → all Guests

| type    | payload                                        | notes                                                                                                                                                |
|---------|------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|
| `state` | `{ epoch, version, snapshot }` (see Heartbeat) | `snapshot` is the full `GameState` (see below), identical for every recipient, sent after every state-changing action and as a heartbeat. No deltas/patches. |

### Heartbeat and `state` payload

The `state` payload wraps the snapshot: `{ epoch: string, version: number, snapshot: GameState }`.

- `epoch`: a random ID created once per Host boot (a reload or resume gets a new one). It makes a Host restart visible
  to Guests. Never persisted.
- `version`: starts at 0 on every Host boot and rises by one only when the snapshot differs from the previous broadcast.
  Never persisted. (`seq` is unchanged: it still rises on every Host message.)
- **Heartbeat:** from Room creation (Lobby and Game) the Host re-sends the current `state` every 3 s
  (`HEARTBEAT_INTERVAL_MS`). It sends nothing while no Guest is connected, stops when the Room closes, and changes
  neither the Host's game state nor the saved session.
- **Guest handling:** every `state` is a sign of life. The Guest skips its re-render and Bet-confirmation work when
  `epoch` and `version` both equal the last pair it saw; it never drops a message for a lower `version`. 9 s without
  any `state` (`HOST_SILENCE_TIMEOUT_MS`) means the link is lost and the Guest starts its reconnect loop. A sent Bet
  with no confirming `state` after 4 s (`BET_CONFIRMATION_TIMEOUT_MS`) is treated the same way.

This is a breaking change for Guests running an older build: they cannot parse the wrapped payload.

## `GameState` shape

One canonical shape, shared by the `state` message's `snapshot` and the persisted `localStorage` snapshot (the latter wraps
it as `{ schemaVersion, savedAt, state }` — see ADR 0003). `GameState` carries only data a
Guest needs to render — it is not a dumping ground for Host-internal bookkeeping (see `challengeHistory` below).

```ts
type GameState = {
  roomId: string;
  status: 'lobby' | 'active' | 'ended';
  challengerId: string | null;
  players: Player[];
  round: RoundState | null;
  resolution: ResolutionState | null;
};

type Player = {
  playerId: string;       // public identifier, see Identity model
  name: string;
  points: number;
  status: 'active' | 'paused' | 'removed';
  connected: boolean;      // live connection status, independent of `status`
};

type RoundState = {
  challengerId: string;
  challengeId: string;     // Challenge Bank id, identical for everyone; each client resolves its own Display
                            // Language content locally (see ADR 0005); the Challenger's own client hides it
  bets: Bet[];
  outcome: 'YES' | 'NO' | null;
};

type Bet = {
  playerId: string;
  amount: number;
  prediction: 'YES' | 'NO';
};

type ResolutionState = {
  challengerId: string;
  outcome: 'YES' | 'NO';
  payouts: Payout[];
};

type Payout = {
  playerId: string;
  amount: number;         // signed: negative on a loss
};
```

Notes:

- `status: 'lobby'`: broadcast before the game starts (on every Guest join, rejoin, leave and disconnect), so every
  device's Lobby/waiting screen can render the live roster — the Host included, with "(you)" on the viewer's own
  entry. `round` and `resolution` are always `null` here, and `challengerId` is always `null`. A Guest only ever
  leaves its waiting screen on a `status: 'active'` broadcast (see `watchForGameStart` in `room-lifecycle`) — a Lobby
  snapshot never starts the game. Lobby snapshots are not written to the Host's persisted `localStorage` snapshot (see
  host-persistence spec).
- `challengerId` tracks the current (or, right after a Resolution, the next) Challenger; `null` before the first
  Round starts.
- `resolution` carries the most recently completed Round's outcome and Payouts, so a Guest can render the result
  screen; `null` once no Resolution is pending display.
- Removed players stay in `players` forever (`status: 'removed'`) — there is no unremove.
- Host-only actions (start round, submit outcome, Pause/Remove) are never wire messages — they're local reducer calls
  whose effects simply appear in the next `state` broadcast.
- **Redraw:** when the Host redraws the Challenge (see `domain-glossary.md`), the Round keeps its `challengerId` and
  gets a new `challengeId`, and `bets` is emptied. There is no extra field: a Guest detects a Redraw as a changed
  `challengeId` within the same Round. A `placeBet` still carrying the replaced `challengeId` is refused with
  `rejected` reason `STALE_CHALLENGE`; the Host changes no state, and the Guest handles it silently (the next `state`
  already shows the new Challenge and an empty bet form). This is a breaking change for Guests running an older build:
  their `placeBet` has no `challengeId`, so the Host cannot parse it. Guests must reload to the new build.
- `challengeHistory` (Challenge Bank ids already drawn this game, see Challenge History) is **not** part of
  `GameState` and is never broadcast — no Guest reads it. It exists only inside the Host's persisted `localStorage`
  snapshot, alongside (not inside) `state`: `{ schemaVersion, savedAt, state, challengeHistory }`.
