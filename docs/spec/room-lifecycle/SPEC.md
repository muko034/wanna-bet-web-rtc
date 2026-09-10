## Problem Statement

A group of friends/family wants to play "Wanna Bet" together, each on their own phone, in the same physical room —
without anyone setting up a server, account system, or shared infrastructure. Right now there's no way to gather
everyone's devices into a single shared game session.

## Solution

One player becomes the **Host** and creates a **Room**: their device generates a shareable link/code and holds the
authoritative Game State. Every other player (**Guest**) opens that link on their own device and connects directly to
the Host over a WebRTC data channel — no backend, no signaling beyond the initial connection bootstrap. Each Guest is
assigned a persistent random player ID, stored in their own device's `localStorage`, so a dropped connection or
accidental page reload lets them rejoin the same player slot instead of appearing as a brand-new player.

## User Stories

1. As a Host, I want to create a Room from the app, so that I get a shareable link/code to send to my friends.
2. As a Host, I want to see a waiting/lobby screen listing connected players as they join, so that I know who's in
   before starting.
3. As a Guest, I want to open the Host's shared link and be prompted for a display name, so that I can join the Room.
4. As a Guest, I want a persistent player ID generated and stored on my own device the first time I join, so that
   reconnecting doesn't create a duplicate player.
5. As a Guest, I want to be connected directly to the Host's Room after entering my name, so that I can see the shared
   game state.
6. As a Host, I want the Room to require at least 2 total players before the game can start, so that the game rules
   (which need at least one Bettor) are satisfiable.
7. As a Host, I want the Room capped at 20 total players, so that the game stays at the personal-use scale it's designed
   for.
8. As a Host, I want to be notified when a Guest disconnects, so that I can see who's currently online.
9. As a Guest, I want to reconnect using the same link after a dropped connection or page reload, so that I resume as my
   same player (same name, same Points) rather than joining as a new one.
10. As a Host, I want a reconnecting Guest matched to their existing player record by their persistent player ID, so
    that no duplicate players are created.
11. As a Guest, I want to see a clear error if the Room link is invalid or the Host is unreachable, so that I know I
    can't join.
12. As a Guest, I want to see a clear message if the Room is already full (20 players), so that I understand why I can't
    join.
13. As any player, I want to see other players' connection status (connected/disconnected) reflected somewhere in the
    shared UI, so that I understand why a round might be waiting.
14. As a Host, I want the Room to end for all Guests if I close my tab, so that everyone understands the session is
    over.
15. As a Guest, I want my display name to be visibly distinguished if it collides with another connected player's name,
    so that the group can tell us apart (e.g. suffixed, not silently merged).

## Implementation Decisions

- **Transport abstraction**: introduce a `Transport` interface wrapping PeerJS (`connect`, `send`, `onMessage`,
  `onConnectionChange`, `onDisconnect`). The Round Engine (`round-engine` slice), Host Admin (`host-admin` slice), and
  Host Persistence (`host-persistence` slice) must depend only on this interface's message/state shapes, never on PeerJS
  directly.
- **Message envelope and catalog**: see `docs/message-protocol.md` (the canonical wire-level reference) and ADR 0003 for
  the full rationale. In summary: `{ type, seq, payload }` envelopes; Guest→Host messages are `join`, `rejoin`,
  `placeBet`, `leave`; Host→one-Guest messages are `welcome` and `rejected`; Host→all-Guests is a single unified
  `state` snapshot. There is no `move` message type (superseded — that was a placeholder from the early
  `docs/research/ARCHITECTURE.md` sketch, before the game's actual actions (`placeBet`, etc.) were defined).
- **Public/private identity split**: a Guest is assigned a public `playerId` (safe to broadcast — appears in every
  `state` snapshot) and a private `reconnectToken` (a secret, delivered once via `welcome`, presented only in
  `rejoin`, never rebroadcast). This replaces an earlier "single ID sent with every message" design, which would have
  let any Guest read another player's ID straight out of a `state` broadcast and impersonate them on reconnect — see ADR
  0003 and `docs/spec/room-lifecycle/03-persistent-player-id-and-reconnect.md`.
- **Host-side connection registry**: the Host maintains a mapping of `reconnectToken -> { peerConnection,
  connectionStatus }` separate from the Game State's player list (Points, order, etc. — owned by `round-engine`). This
  registry is what `room-lifecycle` owns and tests. Every message after the handshake is attributed to whichever
  connection it arrived on — Guest action messages carry no identity field to trust or spoof.
- **Room capacity**: enforced Host-side at join time — minimum 2, maximum 20 total players (Host counts as one).
- **Room Code / Transport ID / Room Registry**: a Room's shareable identifier is a 6-character, uppercase **Room
  Code** (unambiguous alphabet — excludes `0`, `O`, `1`, `I`), kept distinct from the underlying `Transport` connection
  ID (the **Transport ID**). A **Room Registry** maps Room Code → Transport ID, generated at Room-creation time with
  retry on collision. `/room/<CODE>` is the canonical shareable link — no separate join-specific route.
- **Client-side routing**: the app uses `preact-router` for `/` (Home), `/room` (Create room), `/room/<CODE>` (Lobby),
  and `/room/<CODE>/play` (placeholder started-game view), plus a not-found view for unmatched routes. `/room/<CODE>`
  doubles as the eventual Guest join entry point (`02-guest-joins-a-room.md`), disambiguated by local identity: the
  Room's creator sees the Host Lobby, an unrecognized visitor sees the Guest join form.
- **Every `state` broadcast carries a monotonically increasing `seq`** (Host-owned, not a timestamp — see ADR 0003)
  so Guests can detect and ignore stale/out-of-order updates, e.g. across a reconnect race.
- **Name collision handling**: on collision, the Host appends a disambiguating suffix (e.g. "Alex (2)") to the newer
  joiner's display name; this does not affect the underlying `playerId`/`reconnectToken`.
- Room/lobby, join, and reconnect screens follow the "Big State" visual design already validated in
  `docs/ui-design/index.html` and its README — this spec does not re-litigate visual design, only the data/connection
  flow behind it.

## Testing Decisions

- **Seam**: the `Transport` interface. Tests exercise the Room/Connection Manager logic (join, leave, reconnect
  matching, capacity enforcement, name collision) against an in-memory fake `Transport` double — no real
  WebRTC/PeerJS/browser needed.
- Modules tested: Connection Manager (registry + capacity + reconnect matching), message envelope encode/decode.
- No end-to-end browser tests against real WebRTC — too flaky/heavy for this project's scale; the fake-transport unit
  tests are the primary safety net, consistent with keeping the number of test seams to one (the Transport interface)
  rather than one per consuming slice.
- **Deferred**: a separate, distinct smoke-test suite for the real PeerJS-backed `Transport` implementation, run
  against a live/local `peerjs-server`. This would validate the adapter itself (does it correctly speak PeerJS), not
  Room/Connection Manager logic — it stays out of the fake-transport unit suite above and is not part of this slice's
  TDD loop. Not yet built; noted here for later.

## Out of Scope

- Host migration on disconnect.
- Spectator mode.
- Self-hosted PeerServer / TURN relay.
- Any persistence beyond the Guest's own player ID in `localStorage` (full Game State persistence is `host-persistence`
  's concern, and is Host-only).
- Pause/remove moderation actions (`host-admin` slice).
- Round/betting/resolution game logic (`round-engine` slice).

## Further Notes

This slice is unblocked and can be built independently of `round-engine`; the two integrate through the Game State shape
that `round-engine` defines and `room-lifecycle` transports over the wire unchanged.
