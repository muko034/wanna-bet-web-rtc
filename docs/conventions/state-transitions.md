# State transitions

## Return the input state object itself when a transition changes nothing

A pure transition function (a reducer, or a memory update like observing or expiring a Result Screen) returns the very
object it was given when the transition is a no-op, and a new object only when something changed. Callers and effects
can then rely on reference equality to skip re-renders and re-stores, and tests can assert "nothing happened" with
`toBe` instead of a deep comparison.

```ts
export function expireResult(memory: ResultMemory, now: number = Date.now()): ResultMemory {
  if (memory.shown === null || now - memory.shown.shownAt < RESULT_SCREEN_DURATION_MS) {
    return memory;
  }
  return dismissResult(memory);
}

expect(expireResult(shown, T0 + 1_000)).toBe(shown);
```
