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

- **`playerId`** (public): included in every `state` broadcast. Safe to expose — used for rotation, scoreboard display,
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
| `placeBet` | `{ amount, prediction }` | Actor derived from the connection binding.                                                                                            |
| `leave`    | `{}`                     | Self-triggered alias for the same remove logic as a Host-initiated Remove (see ADR 0003) — actor derived from the connection binding. |

### Host → one Guest

| type       | payload                        | notes                                                                                                                                                                                                                     |
|------------|--------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `welcome`  | `{ playerId, reconnectToken }` | Sent once, immediately after a successful `join`/`rejoin`, only to that connection. The one and only time `reconnectToken` is transmitted.                                                                                |
| `rejected` | `{ reason, action }`           | Sent only to the Guest whose action was rejected. `action` echoes the offending message's `type` for the Guest's own error handling. `reason` is an extensible string enum (e.g. `INVALID_BET_AMOUNT`, `UNKNOWN_PLAYER`). |

### Host → all Guests

| type    | payload                 | notes                                                                                                    |
|---------|-------------------------|----------------------------------------------------------------------------------------------------------|
| `state` | `GameState` (see below) | Full snapshot, identical for every recipient, sent after every state-changing action. No deltas/patches. |

## `GameState` shape

One canonical shape, shared by the `state` message payload and the persisted `localStorage` snapshot (the latter wraps
it as `{ schemaVersion, savedAt, state }` — see host-persistence spec and ADR 0003). `GameState` carries only data a
Guest needs to render — it is not a dumping ground for Host-internal bookkeeping (see `challengeHistory` below).

```ts
type GameState = {
  roomId: string;
  status: 'active' | 'ended';
  players: Player[];
  round: RoundState | null;
};

type Player = {
  playerId: string;       // public identifier, see Identity model
  name: string;
  points: number;
  status: 'active' | 'paused' | 'removed';
  connected: boolean;      // live connection status, independent of `status`
};

type RoundState = {
  activePlayerId: string;
  challengeId: string;     // Challenge Bank id, identical for everyone; each client resolves its own Display
                            // Language content locally (see ADR 0005); the Active Player's own client hides it
  bets: Bet[];
  outcome: 'YES' | 'NO' | null;
};

type Bet = {
  playerId: string;
  amount: number;
  prediction: 'YES' | 'NO';
};
```

Notes:

- Removed players stay in `players` forever (`status: 'removed'`) — there is no unremove, and the scoreboard must keep
  showing them (see host-admin spec).
- Host-only actions (start round, submit outcome, Pause/Remove) are never wire messages — they're local reducer calls
  whose effects simply appear in the next `state` broadcast.
- `challengeHistory` (Challenge Bank ids already drawn this game, see Challenge History) is **not** part of
  `GameState` and is never broadcast — no Guest reads it. It exists only inside the Host's persisted `localStorage`
  snapshot, alongside (not inside) `state`: `{ schemaVersion, savedAt, state, challengeHistory }`.
