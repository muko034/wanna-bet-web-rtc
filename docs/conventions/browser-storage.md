# Browser storage

## Pass `Storage` in; never reach for `localStorage` inside a store module

A module that persists data on the device exports plain functions that take a `Storage` as their first parameter,
instead of reading the `localStorage` global itself. Only the component or app wiring passes the real `localStorage`;
tests pass the in-memory `FakeStorage` from `src/fake-storage.ts`. This keeps the storage logic unit-testable without a
browser and makes every place that touches real device storage easy to find.

Namespace every key as `wanna-bet:<area>:` followed by the Room Code, held in a module-level `KEY_PREFIX` constant, and
store values as JSON. Scoping by Room Code keeps data for different Rooms on the same device from overwriting each other.

Exception: device-wide preferences that belong to the player, not a Room, use a key without a Room Code and may store a
plain string instead of JSON. Today that is `wanna-bet:language` (the Display Language, `pl` or `en`), which is saved
only on an explicit toggle.

```ts
const KEY_PREFIX = 'wanna-bet:identity:';

export function loadIdentity(storage: Storage, code: string): StoredIdentity | null {
  const raw = storage.getItem(KEY_PREFIX + code);
  return raw === null ? null : (JSON.parse(raw) as StoredIdentity);
}
```

## Defer storage writes triggered from game flow

When the app wiring persists or removes stored data in response to a game event (the Host's autosave after a state change, forgetting a Room's session when the Host Leaves), wrap the call in `setTimeout(..., 0)` inside a small named function and hand that function to the game logic as a callback. Gameplay then never waits on a synchronous storage call, and a deferred delete runs after any save still queued, so a final save cannot resurrect what was just removed.

```ts
function forgetSession(code: string): void {
  setTimeout(() => deleteHostSession(localStorage, code), 0);
}
```
