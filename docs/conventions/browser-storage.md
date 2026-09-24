# Browser storage

## Pass `Storage` in; never reach for `localStorage` inside a store module

A module that persists data on the device exports plain functions that take a `Storage` as their first parameter,
instead of reading the `localStorage` global itself. Only the component or app wiring passes the real `localStorage`;
tests pass the in-memory `FakeStorage` from `src/fake-storage.ts`. This keeps the storage logic unit-testable without a
browser and makes every place that touches real device storage easy to find.

Namespace every key as `wanna-bet:<area>:` followed by the Room Code, held in a module-level `KEY_PREFIX` constant, and
store values as JSON. Scoping by Room Code keeps data for different Rooms on the same device from overwriting each other.

```ts
const KEY_PREFIX = 'wanna-bet:identity:';

export function loadIdentity(storage: Storage, code: string): StoredIdentity | null {
  const raw = storage.getItem(KEY_PREFIX + code);
  return raw === null ? null : (JSON.parse(raw) as StoredIdentity);
}
```
