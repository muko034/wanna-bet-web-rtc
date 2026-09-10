**Blocked by**: none

## Status

A first pass at this slice already landed, and part of it stands: the `Transport` interface (connect/send/receive/
connection-status), a real PeerJS-backed implementation, and an in-memory fake implementation used by tests, all
still valid as-is.

What that pass got wrong, and this revision corrects:
- Room creation exposed the raw `Transport` connection ID (`transport.connect()`) as the Room's shareable identifier,
  with no distinct Room Code — corrected below via a Room Code + Room Registry.
- The app rendered a single `HostLobby` component with no routing at all — corrected below via `preact-router` and
  three real routes plus a placeholder fourth.
- The lobby's "Start game" action didn't exist / wasn't gated — corrected below via a minimum-1-Guest gate.

## What to build

A player opens the app and creates a Room, becoming its Host. Room creation now produces a **Room Code**: a 6-character
uppercase code (unambiguous alphabet — excludes `0`, `O`, `1`, `I`) distinct from the underlying `Transport` connection
ID, generated via a **Room Registry** that maps Room Code → Transport ID and retries on collision. `/room/<CODE>` is
the canonical shareable link.

The app gains three routed views plus a placeholder fourth, using `preact-router`:
- `/` — **Home**: "Create a game" button, plus a visibly disabled "Join a game" button (joining itself is out of scope
  — see `02-guest-joins-a-room.md`).
- `/room` — **Create room**: a form to enter the Host's display name and create the Room. Directly addressable (no
  redirect if opened without prior navigation).
- `/room/<CODE>` — **Lobby**: shows the Room Code and full canonical link (with a copy action), the connected player
  list (empty until Guests exist), a persistent "The game has not started yet." status, and a "Start game" button that
  stays visible but disabled until at least one Guest is present.
- `/room/<CODE>/play` — placeholder started-game view (no gameplay logic yet). Opening it while the Room hasn't
  started redirects back to the Lobby.

An unknown route renders a not-found view with a link back to Home.

This task continues to own the `Transport` abstraction wrapping PeerJS — no other slice should depend on PeerJS
directly, only on this interface.

## Acceptance criteria

- [x] A `Transport` interface exists (connect/send/receive/connection-status), with a real PeerJS-backed implementation
  and an in-memory fake implementation usable in tests without any real networking.
- [ ] A player can create a Room from the app and becomes its Host.
- [ ] Room creation generates a 6-character, unambiguous-alphabet Room Code, distinct from the Transport ID, via a Room
  Registry that retries on collision.
- [ ] `/room/<CODE>` is the canonical shareable link; the Lobby displays both the Room Code and the full URL, with a
  copy action.
- [ ] The app exposes four routes (`/`, `/room`, `/room/<CODE>`, `/room/<CODE>/play`) via `preact-router`, plus a
  not-found view for unmatched routes.
- [ ] Home shows "Create a game" and a visibly disabled "Join a game".
- [ ] The Lobby lists connected players (empty at this point, since no Guests exist yet) and shows a persistent "The
  game has not started yet." status.
- [ ] The Lobby's "Start game" button is visible but disabled until at least one Guest has joined.
- [ ] `/room/<CODE>/play` renders a neutral placeholder "game started" state with no gameplay logic, and redirects to
  the Lobby if the Room hasn't started.
