**Blocked by**: 14 (Game state reaches the Guest device)

**Status**: Implemented

## What to build

Wire `START_ROUND` end-to-end: the first Round starts automatically alongside the game itself — no separate Host
control — with the Active Player automatically designated (picked at random for the very first Round, then following
the fixed rotation order that first pick establishes, per `docs/game-rules.md`), driving `roundEngineReducer`'s
`START_ROUND` action and broadcasting the resulting `GameState`. Every connected device must render the drawn
Challenge according to its own role in that Round — hidden (a placeholder, per ADR 0004) on the Active Player's own
device, visible (text + any Illustration) to everyone else — using only the broadcast `GameState`'s
`activePlayerId`/`challengeId`, never a side channel.

## Acceptance criteria

- [x] The first Round starts automatically alongside the game itself, with no separate Host control; the Active
      Player is designated automatically — random for the first Round, then the fixed rotation order that first
      pick establishes for every Round after.
- [x] `START_ROUND` runs through the reducer with a real Challenge Bank source (`src/challenge-bank/challenge-bank.ts`)
      and the Room's Challenge History, and the resulting `GameState` is broadcast to all Guests.
- [x] The Active Player's own device shows a hidden/placeholder Challenge card while the Round is open — no Challenge
      text or Illustration content reaches that device's rendered output or DOM.
- [x] Every other connected device (Bettors, and the Host if the Host is not the Active Player) shows the real
      Challenge text and any Illustration.
- [x] Betting/Outcome controls are not yet wired in this task (see 16, 17) — it's acceptable for the UI to show a
      "waiting" state for those until then.
- [x] Tests cover: the hidden-vs-visible Challenge rendering decision for the Active Player vs. every other role,
      using the existing fake `Transport` seam (per `docs/round-engine/SPEC.md`'s testing decisions, prefer a plain
      unit-testable "what should this device show" function over asserting on rendered DOM, consistent with how the
      reducer itself is tested).
