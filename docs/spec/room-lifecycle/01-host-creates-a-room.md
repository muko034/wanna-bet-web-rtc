**Blocked by**: none

**Status**: Implemented — all acceptance criteria below are met.

## What to build

A player opens the app and creates a Room, becoming its Host. Room creation now produces a **Room Code**: a 6-character
uppercase code (unambiguous alphabet — excludes `0`, `O`, `1`, `I`) distinct from the underlying `Transport` connection
ID, generated via a **Room Registry** that maps Room Code → Transport ID and retries on collision. `/room/<CODE>` is
the canonical shareable link.

The app gains three routed views plus a placeholder fourth:
- `/` — **Home**: "Create a game" button, plus a visibly disabled "Join a game" button (joining itself is out of scope
  — see `02-guest-joins-a-room.md`).
- `/room` — **Create room**: a form to enter the Host's display name and create the Room. Directly addressable (no
  redirect if opened without prior navigation).
- `/room/<CODE>` — **Lobby**: shows the Room Code and full canonical link (with a copy action), the connected player
  list (empty until Guests exist), a persistent "The game has not started yet." status, and a "Start game" button that
  stays visible but disabled until at least one Guest is present.
- `/room/<CODE>/play` — placeholder started-game view (no gameplay logic yet). Opening it while the Room hasn't
  started redirects back to the Lobby.

An unknown route renders a not-found view with a link back to Home. Visiting `/room/<CODE>` or `/room/<CODE>/play`
for a Room Code that doesn't match the Host's actual active Room — including when no Room is active on this device at
all — renders that same not-found view, rather than a distinct "no active Room" message.

This task continues to own the `Transport` abstraction wrapping PeerJS — no other slice should depend on PeerJS
directly, only on this interface.

## Acceptance criteria

- [x] A `Transport` interface exists (connect/send/receive/connection-status), with a real PeerJS-backed implementation
  and an in-memory fake implementation usable in tests without any real networking.
- [x] A player can create a Room from the app and becomes its Host.
- [x] Room creation generates a 6-character, unambiguous-alphabet Room Code, distinct from the Transport ID, via a Room
  Registry that retries on collision.
- [x] `/room/<CODE>` is the canonical shareable link; the Lobby displays both the Room Code and the full URL, with a
  copy action.
- [x] The app exposes four routes (`/`, `/room`, `/room/<CODE>`, `/room/<CODE>/play`), plus a not-found view for
  unmatched routes and for a Room Code that doesn't match the Host's active Room.
- [x] Home shows "Create a game" and a visibly disabled "Join a game".
- [x] The Lobby lists connected players (empty at this point, since no Guests exist yet) and shows a persistent "The
  game has not started yet." status.
- [x] The Lobby's "Start game" button is visible but disabled until at least one Guest has joined.
- [x] `/room/<CODE>/play` renders a neutral placeholder "game started" state with no gameplay logic, and redirects to
  the Lobby if the Room hasn't started.
