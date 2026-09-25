**Blocked by**: none

## What to build

Reloading `/room/<code>/play` currently shows "Page not found" — the started-game route never attempts to reconnect,
unlike the Lobby route (`/room/<code>`), which already rejoins a Guest from their stored `playerId`/`reconnectToken`
(per `room-lifecycle/03-persistent-player-id-and-reconnect.md`).

Extract that reconnect sequence (load stored identity → open a `Transport` → `rejoin` → wire up the game-state
listeners) out of the Lobby's join screen into a shared implementation, and drive `/room/<code>/play` from the same
implementation on mount whenever it has no live Game State — no redirect through the Lobby route. A Guest
reconnecting into an already-started game must see the current, live Game State, not a stale Lobby view.

A Guest reloading `/room/<code>/play` with no stored identity for that Room Code (never joined, or cleared their
browser data) is sent to the ordinary join form instead of "Page not found." Submitting that form for an
already-started game hits the existing "game already started" rejection — no new player is created mid-game.

A stored identity the Host doesn't recognize (e.g. an invalid `reconnectToken`) falls back to the ordinary join
form, exactly as it does today on the Lobby route.

## Acceptance criteria

- [ ] Reloading `/room/<code>/play` with a stored identity for `<code>` reconnects the Guest instead of showing "Page
      not found".
- [ ] A Guest reconnecting into an already-started game sees the current, live Game State, not a stale Lobby view.
- [ ] Reloading `/room/<code>/play` with no stored identity for `<code>` shows the ordinary join form, not "Page not
      found".
- [ ] Submitting the join form for a Room whose game has already started is rejected with the existing "game already
      started" message.
- [ ] A stored identity rejected by the Host as unknown falls back to the ordinary join form, exactly as it does
      today on the Lobby route.
- [ ] The Lobby's join screen and `/room/<code>/play` drive the same shared reconnect implementation — not two
      separate copies.
