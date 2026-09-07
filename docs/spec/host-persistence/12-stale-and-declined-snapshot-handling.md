**Blocked by**: 11 (Autosave + resume prompt)

## What to build

Two failure/decline paths for the resume flow: declining the resume prompt discards the snapshot, and a snapshot
written by an incompatible schema version is treated as if no snapshot exists at all (never partially applied).

## Acceptance criteria

- [ ] Declining the "resume this session?" prompt discards the existing snapshot; a subsequent app load finds no snapshot to resume.
- [ ] Every saved snapshot includes a `schemaVersion` field.
- [ ] Loading a snapshot whose `schemaVersion` doesn't match the current app's expected version is treated as no snapshot present, and does not crash or partially restore state.
