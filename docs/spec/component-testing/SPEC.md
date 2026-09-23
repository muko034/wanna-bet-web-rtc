## Problem Statement

The unit suite runs in Node and never renders a Preact component. It covers pure resolvers, reducers, the
`ConnectionManager` and the Guest join flow functions against the fake `Transport`, but none of the code that lives only
inside components: effects and their dependency lists, what happens on mount and unmount, refs, route changes, and how
`App` hands callbacks and state down to screens.

That gap already caused a real bug. When the Host started sending Lobby `state` updates, a Guest's `JoinRoom` rejoin
effect re-ran on every update (a callback it depended on was a new function on each render). Each run opened a new
`PeerJsTransport` and never closed the old one, until the browser ran out of connections and the Guest saw "This room
link doesn't exist or has expired." Every function involved was correct on its own and fully tested. The fault was in
the component wiring, which no test can see today.

## Solution

Add a second, narrow kind of test: **component tests** that render real screens in a DOM environment, with the fake
`Transport` playing the other side of the connection. They check component wiring only: effects run when they should
(and not otherwise), connections are opened and closed at the right moments, and screens react to incoming messages and
route changes.

Game logic and display logic stay in pure modules with unit tests (see `docs/conventions/view-resolvers.md`). Component
tests do not repeat those checks.

## User Stories

1. As a developer, I want a component-wiring bug like the `JoinRoom` reconnect loop to fail a test, so that it is caught
   before a real Guest hits it.
2. As a developer, I want to render a screen with a fake `Transport` instead of a real PeerJS connection, so that
   component tests are fast, deterministic and need no network.
3. As a developer, I want component tests to run with `npm test`, so that there is no extra command to remember.
4. As a developer, I want the existing Node unit tests and the separate PeerJS smoke suite to stay exactly as they are,
   so that adding component tests does not slow them down or change what they check.
5. As a developer, I want a documented convention for when to write a component test and when to write a pure unit
   test, so that logic doesn't drift into components just because they are now testable.

## Implementation Decisions

- **Environment**: a DOM environment (e.g. `jsdom`) and `@testing-library/preact`, as dev dependencies. Applied only to
  component test files, marked by a file suffix (e.g. `*.dom.test.tsx`). All other test files keep running in Node.
- **Transport injection**: a screen that creates a transport takes an optional transport factory, defaulting to
  `PeerJsTransport`. Production code does not pass it, so behavior is unchanged. The shared `Transport` interface does
  not change.
- **Fake Host/Guest**: tests use the existing fake `Transport` to play the other side and send protocol messages.
- **Routing**: tests observe `preact-router` navigation (the current URL or a routing spy) instead of mocking route
  internals.
- **Storage**: tests use a fresh `localStorage` (or the existing fake storage) per test, so stored Guest identities
  don't leak between tests.

## Testing Decisions

- **What a component test checks**: effect timing, mount/unmount cleanup, connection lifecycle, callback and prop
  wiring between `App` and screens, and navigation. Assertions go through what the component does to the outside
  world (transports created, messages sent, callbacks called, routes changed, visible text), not internal state.
- **What it doesn't check**: branching and display rules that belong in pure resolvers, game rules and protocol
  encoding. These keep their Node unit tests.
- **Regression-first**: each known wiring bug gets a test that fails when the fix is reverted.
- **No real WebRTC**: real PeerJS stays the smoke suite's job
  (`docs/spec/room-lifecycle/06-peerjs-transport-smoke-tests.md`).

## Out of Scope

- End-to-end browser tests across two real devices or real WebRTC.
- Visual or snapshot tests of markup and styling.
- Moving existing pure-module tests to the DOM environment.
- Testing `PhoneShell`, `NotFound` and other static screens with no effects or connection logic.

## Further Notes

Tasks:

- [22-component-test-harness-and-join-room.md](22-component-test-harness-and-join-room.md): the harness, plus regression
  tests for the `JoinRoom` reconnect loop. Builds the setup the later task reuses.
- [23-component-tests-for-remaining-screens.md](23-component-tests-for-remaining-screens.md): `StartedGame`,
  `CreateRoom` and `App` wiring.

The room-lifecycle slice's Testing Decisions (one seam: the `Transport` interface) should point here once 22 lands, so
the two don't read as contradicting each other.
