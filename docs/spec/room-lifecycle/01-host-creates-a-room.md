**Blocked by**: none

## What to build

A player opens the app and creates a Room, becoming its Host. The app generates a shareable link/code (via a new
`Transport` abstraction wrapping PeerJS) and the Host lands on a lobby screen showing that link/code and an empty player
list. This task introduces the `Transport` interface itself: a real PeerJS-backed implementation for the app, and an
in-memory fake implementation used by tests — no other slice should depend on PeerJS directly, only on this interface.

## Acceptance criteria

- [ ] A player can create a Room from the app and becomes its Host.
- [ ] The Host sees a shareable link/code representing the Room.
- [ ] The Host sees a lobby view listing connected players (empty at this point, since no Guests exist yet).
- [ ] A `Transport` interface exists (connect/send/receive/connection-status), with a real PeerJS-backed implementation
  and an in-memory fake implementation usable in tests without any real networking.
