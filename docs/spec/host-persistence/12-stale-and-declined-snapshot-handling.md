**Blocked by**: 11 (Autosave + auto-resume)

**Status**: Implemented

## What to build

Two failure paths for the resume flow: a stale snapshot (e.g. a Room abandoned without End Game) is discarded, and a
snapshot written by an incompatible schema version is treated as if no snapshot exists at all (never partially
applied). Stale is defined as an absolute `ttl` (24h from the most recent save) having passed.

## Acceptance criteria

- [x] A stale snapshot is discarded; opening its Room's link afterwards does not resume it.
- [x] A stale snapshot whose Room Code has since been taken by another Host's Room does not stop this device from
      joining that Room as a Guest.
- [x] Every saved snapshot includes a `schemaVersion` field.
- [x] Loading a snapshot whose `schemaVersion` doesn't match the current app's expected version is treated as no snapshot present, and does not crash or partially restore state.
