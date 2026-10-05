# Testability

## Inject randomness and the clock as defaulted parameters

When logic depends on something nondeterministic (a random pick, a generated code, the current time), take it as a
trailing constructor or function parameter whose default is the real source. Production callers omit it; tests pass a
fixed value or a deterministic function so they can assert exact outcomes without mocking globals.

```ts
constructor(generateRoomCode: () => string = generateCode) { /* ... */ }

export function saveHostSession(storage: Storage, session: HostSession, now: number = Date.now()): void {
```

## Use `it.each` tables for input/output variations of one behaviour

When several cases exercise the same behaviour with different inputs, write one `it.each` table instead of copy-pasted
`it` blocks. Add a leading label column when cases need names, and use printf placeholders (`%s`, `%i`) in the title so
each row reports readably.

```ts
it.each([
  ['plain code', 'ABCDEF', 'ABCDEF'],
  ['full URL', 'https://example.com/room/abcdef', 'ABCDEF'],
])('%s', (_name, input, expected) => {
  expect(extractRoomCode(input)).toBe(expected);
});
```
