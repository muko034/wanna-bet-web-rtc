**Blocked by**: 14 (Game state reaches the Guest device)

## What to build

Wire `START_ROUND` end-to-end: a Host control to start a Round for a chosen Active Player, driving
`roundEngineReducer`'s `START_ROUND` action and broadcasting the resulting `GameState`. Every connected device must
render the drawn Challenge according to its own role in that Round — hidden (a placeholder, per ADR 0004) on the
Active Player's own device, visible (text + any Illustration) to everyone else — using only the broadcast
`GameState`'s `activePlayerId`/`challengeId`, never a side channel.

## Acceptance criteria

- [ ] The Host can pick (or the UI otherwise designates) an Active Player and trigger a Round start.
- [ ] `START_ROUND` runs through the reducer with a real Challenge Bank source (`src/challenge-bank/challenge-bank.ts`)
      and the Room's Challenge History, and the resulting `GameState` is broadcast to all Guests.
- [ ] The Active Player's own device shows a hidden/placeholder Challenge card while the Round is open — no Challenge
      text or Illustration content reaches that device's rendered output or DOM.
- [ ] Every other connected device (Bettors, and the Host if the Host is not the Active Player) shows the real
      Challenge text and any Illustration.
- [ ] Betting/Outcome controls are not yet wired in this task (see 16, 17) — it's acceptable for the UI to show a
      "waiting" state for those until then.
- [ ] Tests cover: the hidden-vs-visible Challenge rendering decision for the Active Player vs. every other role,
      using the existing fake `Transport` seam (per `docs/round-engine/SPEC.md`'s testing decisions, prefer a plain
      unit-testable "what should this device show" function over asserting on rendered DOM, consistent with how the
      reducer itself is tested).
