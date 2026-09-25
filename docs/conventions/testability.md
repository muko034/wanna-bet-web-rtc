# Testability

## Inject randomness and the clock as defaulted parameters

When logic depends on something nondeterministic (a random pick, a generated code, the current time), take it as a
trailing constructor or function parameter whose default is the real source. Production callers omit it; tests pass a
fixed value or a deterministic function so they can assert exact outcomes without mocking globals.

```ts
constructor(generateRoomCode: () => string = generateCode) { /* ... */ }

export function saveHostSession(storage: Storage, session: HostSession, now: number = Date.now()): void {
```
