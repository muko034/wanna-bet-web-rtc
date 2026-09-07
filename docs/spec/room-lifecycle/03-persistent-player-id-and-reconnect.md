**Blocked by**: 2 (Guest joins a Room)

## What to build

Each Guest is assigned a persistent random player ID on first join, stored in that Guest's own `localStorage`, and
sent with every outgoing message. If a Guest reconnects (dropped connection or page reload) using the same link, the
Host matches them back to their existing player record by that ID instead of registering a new player. The Host also
tracks and surfaces each player's live connection status (connected/disconnected).

## Acceptance criteria

- [ ] A Guest is assigned a persistent player ID on first join, stored in their own browser's `localStorage`.
- [ ] Reloading the Guest's page and rejoining via the same link reconnects them to their same existing player record (same name, no duplicate player created).
- [ ] The Host's view reflects each player's live connection status (connected vs. disconnected).
- [ ] A Guest whose connection drops and later reconnects is matched by their persistent player ID, not by name.
