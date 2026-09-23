**Blocked by**: 14 (Game state reaches the Guest device)

**Status**: Implemented

## What to build

Every player in the Lobby sees everyone who is in the Room, the Host included, with their own entry marked "(you)"
(no Points are shown in the Lobby).

- **Host's Lobby:** the player list currently shows Guests only; it now includes the Host's own entry, marked "(you)".
- **Guest's waiting screen:** today a Guest sees only "You're in!" and cannot tell who else is in the Room, because the
  first `state` broadcast happens when the game starts. The Host now broadcasts the normal `state` snapshot on every
  join, rejoin, leave and disconnect *before* the game starts, using a new `lobby` status, so the Guest's waiting screen
  lists everyone with "(you)" on their own entry.

This stays within ADR 0003's single-snapshot decision — no new message type. Game-start detection on the Guest is
unchanged (only an `active` status starts the game), and Lobby snapshots are not persisted by `host-persistence`.

## Acceptance criteria

- [x] `GameState.status` accepts a `lobby` value; the Host builds a Lobby snapshot (all players including the Host, no
      open Round, no Resolution) from the current Room.
- [x] The Host broadcasts a Lobby snapshot after every Guest join, rejoin, leave and disconnect before the game starts;
      a newly joined or rejoined Guest receives it too.
- [x] A Lobby snapshot never starts the game on a Guest; the first `active` snapshot still does.
- [x] The Host's Lobby lists the Host and all Guests, with "(you)" on the Host's own entry; the "Start game" rules from
      01/02 are unchanged.
- [x] The Guest's waiting screen lists everyone in the Room with "(you)" on their own entry and updates as players
      join or leave.
- [x] Lobby snapshots are not written to the persisted snapshot.
- [x] The roster's display shape (names, "(you)") comes from a pure resolver shared by the Host and Guest screens, with
      unit tests; Host-side broadcast triggers and Guest-side handling have tests at the existing protocol/connection
      seams.
