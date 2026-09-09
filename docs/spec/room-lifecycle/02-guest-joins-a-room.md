**Blocked by**: 1 (Host creates a Room)

## What to build

A Guest opens the Host's shared link, enters a display name, and connects directly to the Host over the `Transport`
interface. The Host's lobby updates live to show the new Guest. The Room enforces a minimum of 2 and maximum of 20
total players, and gives clear feedback for an invalid link, an unreachable Host, or a full Room. Colliding display
names are disambiguated automatically.

## Acceptance criteria

- [ ] A Guest can open the Room link, enter a name, and connect; the Host's lobby list updates to show them.
- [ ] A Guest attempting to join a Room already at 20 total players sees a clear "Room is full" message and does not connect.
- [ ] A Guest opening an invalid or unreachable Room link sees a clear error message.
- [ ] A Host cannot start the game (in a later slice) with fewer than 2 total players — this task only needs to expose that count/state, not gate an actual "start game" action yet.
- [ ] Two Guests joining with the same display name are both connected, with the second joiner's displayed name automatically disambiguated (e.g. a suffix); their underlying identities remain distinct.
