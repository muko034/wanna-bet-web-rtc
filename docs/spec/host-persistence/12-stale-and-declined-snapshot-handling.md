**Blocked by**: 11 (Autosave + auto-resume)

## What to build

Two failure paths for the resume flow: a stale snapshot (e.g. a Room abandoned without End Game) is discarded, and a
snapshot written by an incompatible schema version is treated as if no snapshot exists at all (never partially
applied). What counts as stale is still to be decided.

## Acceptance criteria

- [ ] A stale snapshot is discarded; opening its Room's link afterwards does not resume it.
- [ ] A stale snapshot whose Room Code has since been taken by another Host's Room does not stop this device from
      joining that Room as a Guest.
- [ ] Every saved snapshot includes a `schemaVersion` field.
- [ ] Loading a snapshot whose `schemaVersion` doesn't match the current app's expected version is treated as no snapshot present, and does not crash or partially restore state.
