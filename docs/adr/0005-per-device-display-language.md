# Display Language is per-device, resolved locally from an identically bundled Challenge Bank

We considered making language a Room-wide setting synced through the Host-authoritative Game State (consistent with
how every other piece of state is broadcast — see ADR 0001/0003), but chose to keep Display Language entirely local to
each player's own device instead: it's never part of `GameState`, has no wire message of its own, and defaults to
Polish in `localStorage` until the player changes it. This lets each player see their own language independent of
what Room they're in or what anyone else picked, without adding a new synced field or a translation round-trip.

A direct consequence: the wire protocol's `RoundState.challengeId` carries only a Challenge Bank id, never rendered
text. This works because the Host and every Guest load the identical static app bundle (no backend, per ADR 0001), so
the full bilingual Challenge Bank already exists on every device; each client just looks up its own Display Language's
`content` for that id locally. Sending full bilingual text instead was considered and rejected as unnecessary payload
duplication of data every client already has.

Separately, this is also why Challenge History (the Room's list of already-drawn Challenge Bank ids) is Host-internal
persisted state, not a `GameState` field: only the Host's own random-draw exclusion logic reads it, so it never needs
to reach a Guest at all.
