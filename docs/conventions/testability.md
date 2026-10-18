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

## Restore real timers in `afterEach` after faking them

A test file that calls `vi.useFakeTimers()` pairs it with `vi.useRealTimers()` in `afterEach`, so a faked clock never
leaks into the next test or file. Use `beforeEach`/`afterEach` at the top of the file or `describe` when every test needs
fake timers, and `afterEach` alone when only some tests fake them.

```ts
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
```

## Advance fake timers inside `act` through a local `settle` or `advance` helper

A component test that fakes timers never calls `vi.advanceTimersByTime` bare: state updates it triggers must run inside `act`. Declare a small helper at the top of the file. `settle` is async and flushes the promises a timer callback or a connection attempt leaves pending; `advance` is the sync variant for timers that only set state. Calling `settle()` with no argument flushes pending work without moving the clock.

```ts
const settle = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
```

## Name component tests `*.test.tsx` and logic tests `*.test.ts`

The file extension picks the test environment. `*.test.ts` files run in Node with no DOM; `*.test.tsx` files run in
jsdom with a shared setup file. That setup file unmounts rendered components, clears `localStorage`, resets the
`FakeTransport` network and restores real timers after every test, so a test never repeats that cleanup itself. A test
that renders JSX must therefore be `.tsx`, and a test that needs no DOM stays `.ts`.

## Split a screen's tests by topic into `<Component>.<topic>.test.tsx` files

When a screen has several distinct concerns to test (Host-only controls, effects driven by a timer, a transient notice),
give each concern its own sibling file named `<Component>.<topic>.test.tsx` in kebab-case, such as
`StartedGame.host-admin.test.tsx` and `StartedGame.roster-notice.test.tsx`, instead of growing one file. The plain
`<Component>.test.tsx` keeps the screen's core behaviour. Each file declares its own fixtures (room, players, state
builder) and its own fake-timer setup, so it reads and runs on its own. A new prop that every render needs is added to
the render helper of each file.

```
StartedGame.test.tsx
StartedGame.local-state.test.tsx
StartedGame.roster-notice.test.tsx
StartedGame.host-admin.test.tsx
```

## Test a screen against `FakeTransport`, not a mocked Transport

Components and hooks that talk to a Transport accept the `Transport` interface, not a concrete class. Tests hand them a
`FakeTransport` and drive the real Host or Guest code on the other end of the in-memory network. Behaviour is then
checked through real message flow instead of hand-stubbed `send` and `on` calls. Helpers shared by several component
tests (a factory that records every Transport it creates, a function that starts a Host with a stored Guest) live in a
`*-test-harness.ts` file beside them.

## Stub child screens when testing the component that routes to them

A test of a parent such as `App` replaces its child screens with `vi.mock` stubs that record the props they receive and
render a short marker. The test then asserts what the parent wires into each screen without running the screen's own
logic, which has its own tests.

```tsx
vi.mock('./room-lifecycle/Lobby', async () => {
  const { h } = await import('preact');
  return { Lobby: (props) => ((screenProps.Lobby = props), h('div', null, `lobby ${props.code}`)) };
});
```

## Build a multi-step scenario in a setup function that returns handles

When several tests start from the same multi-step scenario (a started game with a joined Guest, a Host with a stored
Guest), put the steps in a named `async` setup function such as `startedGameWithGuest`, declared inside the `describe`
(or at file level when several `describe`s share it). It returns an object of the handles the tests need, and each test
awaits it and destructures only what it uses. Don't spread the scenario over shared `let` variables filled in by
`beforeEach`: that hides which test needs what and cannot take per-test options. Reserve `beforeEach` for environment
setup such as fake timers, stubbed browser APIs and mock resets.

```ts
async function startedGameWithGuest(pickChallenger: (ids: string[]) => string = () => 'host-1') {
  /* build manager, connect and join the Guest, start the game */
  return { manager, hostId, guest, playerId, reconnectToken };
}

const { manager, guest, playerId } = await startedGameWithGuest();
```
