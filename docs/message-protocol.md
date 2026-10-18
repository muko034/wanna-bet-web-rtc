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
connection (`placeBet`, `leave`, `sitOut`) carries no identity field at all — the Host derives the actor from the connection
itself, so impersonation after the handshake is structurally impossible, not just discouraged.

Room access control is the shareable link/`peerId` alone (per ADR 0001) — no separate join PIN.

## Messages

### Guest → Host

| type       | payload                  | notes                                                                                                                                 |
|------------|--------------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| `join`     | `{ name }`               | Sent once, as the first message on a fresh connection, when the Guest has no stored `reconnectToken`. In the Lobby the Host answers at once with `welcome`. After Start it is a Join Request: the Host holds it until it admits (`welcome`) or declines (`rejected`, `JOIN_DECLINED`), see [Join after Start](#join-after-start). |
| `rejoin`   | `{ reconnectToken }`     | Sent once, as the first message on a fresh connection, when the Guest has a stored `reconnectToken` from a prior session.             |
| `placeBet` | `{ amount, prediction, challengeId }` | Actor derived from the connection binding. `challengeId` is the Challenge the Bettor saw when betting. Confirmed only by a `state` showing the Bet; refused with `rejected` (`action: 'placeBet'`), including `STALE_CHALLENGE` when `challengeId` no longer matches the Round's Challenge. |
| `leave`    | `{}`                     | Self-triggered alias for the same remove logic as a Host-initiated Remove (see ADR 0003) — actor derived from the connection binding. Before the Game starts the Guest leaves the Lobby roster; in the Game their row stays in `players` as `status: 'removed'` with their last Points. Either way their reconnect token is deleted, so a later `rejoin` is refused with `UNKNOWN_PLAYER`. |
| `sitOut`   | `{}`                     | The Guest steps away (see Sit Out in the glossary). The Host sets the player to `status: 'paused'`, `pausedBy: 'self'`, except a player already paused with `pausedBy: 'host'`, who keeps it; actor derived from the connection binding. The Guest then closes its transport. A placed Bet stays in the Round; a Challenger's Round is discarded and the Game rotates. |

### Host → one Guest

| type       | payload                        | notes                                                                                                                                                                                                                     |
|------------|--------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `welcome`  | `{ playerId, reconnectToken }` | Sent once, immediately after a successful `join`/`rejoin`, only to that connection. The one and only time `reconnectToken` is transmitted.                                                                                |
| `rejected` | `{ reason, action }`           | Sent only to the Guest whose action was rejected. `action` echoes the offending message's `type` for the Guest's own error handling. `reason` is an extensible string enum (e.g. `INVALID_BET_AMOUNT`, `UNKNOWN_PLAYER`, `STALE_CHALLENGE`, `ROOM_FULL`, `JOIN_DECLINED`). |

### Host → all Guests

| type    | payload                                        | notes                                                                                                                                                |
|---------|------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|
| `state` | `{ epoch, version, snapshot }` (see Heartbeat) | `snapshot` is the full `GameState` (see below), identical for every recipient, sent after every state-changing action and as a heartbeat. No deltas/patches. |

### Join after Start

A `join` after the Game started is a Join Request (see the glossary). There is no new message type:

- **Queue.** The Host does not answer at once. It keeps the request in memory, in arrival order, with the connection it
  came on. If the Room already holds 20 players (`MAX_ROOM_PLAYERS`, the Host included) it answers `rejected` with
  `ROOM_FULL` and `action: 'join'` instead, and queues nothing. The queue is never persisted: a Host reload drops it,
  and the Guests, whose connections closed, see "Can't reach the Host" and may ask again.
- **Admit.** The Host handles the oldest request, with the starting Points it sets (default: the lowest Points among
  players with `status: 'active'`, the Host included). It checks the cap again, adds the "(n)" suffix to a name that
  clashes with a player in the Game, creates the player, mints the `reconnectToken`, binds the connection, sends
  `welcome` and broadcasts `state`. The Late Joiner is `status: 'active'` at once, last in the Challenger rotation; the
  current Challenger and Round stay. A Host who was ready to judge goes back to waiting for Bets, as after a Resume.
  A Guest who Left or was Removed asks the same way and returns as a new player with a new `playerId`; the old
  `removed` row stays.
- **Decline.** `rejected` with `reason: 'JOIN_DECLINED'` and `action: 'join'`, only to that connection. The Guest may
  send a new `join`.
- **Cancel.** There is no cancel message. The Guest closes its transport, and the Host drops the queued request when
  that connection closes, so it can never admit a Guest who has gone.
- **The wait.** The Guest's 8 s connection timeout covers only opening the connection; there is no reply timeout for the
  answer, since it waits for a person. The Host's heartbeat goes to every open connection, bound or not, and the Guest
  arms its 9 s host-silence watcher as soon as it has sent `join`, so a silent Host ends the wait with "Can't reach the
  Host". Until `welcome` the Guest ignores `state` broadcasts (they still count as signs of life), so it never reaches
  the Game as an unbound spectator.

A Guest on an older build gets no `welcome` within 8 s and shows "unreachable". Accepted, as the developer is the only user.

### Heartbeat and `state` payload

The `state` payload wraps the snapshot: `{ epoch: string, version: number, snapshot: GameState }`.

- `epoch`: a random ID created once per Host boot (a reload or resume gets a new one). It makes a Host restart visible
  to Guests. Never persisted.
- `version`: starts at 0 on every Host boot and rises by one only when the snapshot differs from the previous broadcast.
  Never persisted. (`seq` is unchanged: it still rises on every Host message.)
- **Heartbeat:** from Room creation (Lobby and Game) the Host re-sends the current `state` every 3 s
  (`HEARTBEAT_INTERVAL_MS`). It sends nothing while no Guest is connected and no Join Request waits, stops when the Room closes, and changes
  neither the Host's game state nor the saved session.
- **Guest handling:** every `state` is a sign of life, also before `welcome`. The Guest skips its re-render and Bet-confirmation work when
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
  pausedBy?: 'self' | 'host';  // present only while `status` is 'paused': 'self' is a Sit Out, 'host' a Host Pause
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

- Rejoin and Sit Out: a `rejoin` sets a player with `pausedBy: 'self'` back to `status: 'active'` and clears `pausedBy`;
  a player with `pausedBy: 'host'` stays paused. There is no `resume` message. The Round Engine skips paused players when
  picking the next Challenger and when deciding whether every Bettor has bet.
- `status: 'lobby'`: broadcast before the game starts (on every Guest join, rejoin, leave and disconnect), so every
  device's Lobby/waiting screen can render the live roster — the Host included, with "(you)" on the viewer's own
  entry. `round` and `resolution` are always `null` here, and `challengerId` is always `null`. A Guest only ever
  leaves its waiting screen on a `status: 'active'` broadcast (see `watchForGameStart` in `room-lifecycle`) — a Lobby
  snapshot never starts the game. The only `removed` player a Lobby snapshot ever lists is the one the Host is removing
  (see Host Remove in the Lobby, below). Lobby snapshots are not written to the Host's persisted `localStorage` snapshot (see
  host-persistence spec).
- `status: 'ended'`: the Host Left. It broadcasts one last `state` with `status: 'ended'` (`round` and `resolution` are
  `null`, `players` keep their final Points), deletes its saved session and closes its connections, so the Room cannot be
  reopened. A client that receives it shows the Game Result Screen (final Leaderboard, every Winner on the top Points
  marked). A Guest deletes its stored identity for the Room, closes its transport and keeps the final `GameState` in
  memory only; a reload shows "Can't reach the Host".
- `challengerId` tracks the current (or, right after a Resolution, the next) Challenger; `null` before the first
  Round starts.
- `resolution` carries the most recently completed Round's outcome and Payouts, so a Guest can render the result
  screen; `null` once no Resolution is pending display.
- Removed players stay in `players` forever (`status: 'removed'`) — there is no unremove. A Guest's own `leave` in the
  Game leaves such a row with their last Points; the next `state` already lists it. The Host drops their open Bet (and
  discards a Round whose Challenger left, with no Points change) and deletes their reconnect token. The Leaderboard and
  the Game Result Screen do not show `removed` rows.
- Host Pause and Resume: the Host pauses an active Guest (`status: 'paused'`, `pausedBy: 'host'`) and resumes a
  Host-paused Guest (back to `status: 'active'`, `pausedBy` removed) from the Leaderboard sheet. A resume takes effect at
  once, even mid-Round: the Guest may Bet in the open Round, and a Host who was judging goes back to waiting for Bets
  if the resumed Guest has not Bet. A Guest with `pausedBy: 'self'` (a Sit Out) is not the Host's to resume. A paused
  Guest keeps its link and reads its own `status: 'paused'`, `pausedBy: 'host'` from the next `state` to show
  "The Host paused you"; the next `state` showing it active returns it to the live Round. A dropped connection alone
  never changes any `status`. A Host Pause is part of the persisted session, so it survives a Host reload.
- Host Remove (in the Game): the Host removes any Guest, a Sit Out included, from the Leaderboard sheet after a confirm
  step that names the player; the Host cannot remove themself. The Host handles it like a `leave`: it sets the row to
  `status: 'removed'` with the last Points, drops the player's open Bet (and discards a Round whose Challenger was
  removed, with no Points change), and broadcasts `state`. Only then does it delete the player's reconnect token and
  close their link, shortly after the broadcast so the `state` can leave first. The removed Guest reads its own
  `status: 'removed'` from that `state`, deletes its stored identity and shows "The Host removed you", with one way
  back to Home. A Guest that missed the `state` and sends a `rejoin` is refused with `UNKNOWN_PLAYER` and treated as
  removed too. Removing the last Guest ends the Room, and the Game Result Screen follows. A `removed` row is part of
  the persisted session, but its reconnect token is not restored after a Host reload.
- Host Remove (in the Lobby): the Host removes any Guest from the roster by tapping the Guest's row (its own
  row is not tappable, and Guests never see this), with a hint line under the roster, after the same confirm step
  that names the player. No notice is shown to other players: the roster simply shrinks. The Host first sends one last Lobby snapshot with that player as
  `status: 'removed'`, then deletes the player's reconnect token, drops them from the Room (the player count falls) and
  closes their link shortly after, so the snapshot can leave first. Later snapshots and heartbeats do not list the
  player, and the Lobby roster never renders a `removed` row. The removed Guest reads its own `status: 'removed'` from
  that snapshot, deletes its stored identity and shows "The Host removed you", with one way back to Home. A Guest that
  missed it and sends a `rejoin` is refused with `UNKNOWN_PLAYER` and shows the same screen. Removing the last Guest
  leaves the Lobby open with the Host alone. A Guest removed in the Lobby may join again as a new player.
- Host-only actions (start round, submit outcome, Pause/Resume/Remove) are never wire messages — they're local reducer calls
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
