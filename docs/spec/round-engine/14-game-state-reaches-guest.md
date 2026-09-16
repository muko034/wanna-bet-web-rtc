**Blocked by**: 5 (Single round happy path, round-engine), 2 (Guest joins a Room, room-lifecycle)

**Status**: Implemented

## What to build

The foundational wiring that makes the Round Engine reachable over the network at all, with no Round yet in play.
Today `room-lifecycle`'s `Room`/`Player` model has no Points and no round-engine state, and the Host itself has no
`Player` record (only Guests are tracked in `room.players`) even though the Host is a Player and can be the Active
Player (`docs/domain-glossary.md`). On "Start game," the Host must build the initial `GameState` (from
`src/protocol/messages.ts`) covering every connected player — Host included — each starting with the same baseline
Points, and broadcast it. Guests must receive that broadcast and use it to navigate themselves out of the "waiting"
screen into the gameplay view, instead of relying on the Host's own local `route()` call (which only ever affects the
Host's own device today).

## Acceptance criteria

- [x] The Host counts as a `Player` in the Round Engine's player list (Points, rotation order), not just as an
      implicit `playerCount` entry.
- [x] Starting the game builds an initial `GameState` (`round: null`, every player at the same starting Points) and
      broadcasts it via `HostProtocol.broadcastState`.
- [x] A Guest's `GuestProtocol` receiving a `state` message with `status: 'active'` navigates that Guest's device from
      the "waiting for the Host to start" screen to the gameplay route (`/room/<CODE>/play`), without requiring a
      manual reload.
- [x] The Host's own device also renders the gameplay view immediately on starting (existing behavior, unaffected).
- [x] No Round has started yet at this point — this task only proves `GameState` reaches every device; Round
      start/Challenge/Bet/Outcome behavior is out of scope (see tasks 15–17).
- [x] Tests cover: the Host being included in the broadcast player list, and a Guest transitioning views upon
      receiving the `state` message (using the existing fake `Transport` — no real PeerJS/browser needed, consistent
      with the rest of `room-lifecycle`'s test seam).
