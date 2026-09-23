**Blocked by**: 21 (Lobby roster for Host and Guests)

## What to build

Set up component testing (see this slice's `SPEC.md`) and use it first on the Guest join screen (`JoinRoom`), where the
bug that prompted it lived.

**Background:** once the Host started sending Lobby `state` updates (21), a Guest who joined fell into a reconnect loop.
Each update re-rendered the app. The app passed `JoinRoom` a callback that was a new function on every render, and the
rejoin effect listed it as a dependency, so the effect ran again. By then the Guest's identity was already saved, so
every run opened a new `PeerJsTransport`, sent `rejoin`, and never closed the previous one. The Host replied with
another Lobby update and the loop repeated until the browser ran out of connections ("Insufficient resources"). The
Guest then saw "This room link doesn't exist or has expired."

The fix is already in place: the rejoin effect depends on the Room Code only, reads the callbacks through a ref, and on
cleanup closes a rejoin that is still in flight. This task adds the tests that would have caught it.

- Add the DOM test environment and testing library, limited to component test files.
- Give `JoinRoom` an optional transport factory, defaulting to `PeerJsTransport`, so a test can pass the fake
  `Transport`.
- Write the `JoinRoom` tests below with the fake `Transport` playing the Host.
- Add a short convention to `docs/conventions/` on when to write a component test versus a pure unit test.

## Acceptance criteria

- [ ] Component test files (e.g. `*.dom.test.tsx`) run as part of `npm test` in a DOM environment. Other test files
      still run in Node, and the smoke suite is unaffected.
- [ ] `JoinRoom` accepts an optional transport factory; without one it uses `PeerJsTransport` exactly as today.
- [ ] **No reconnect loop:** a Guest with a stored identity mounts `JoinRoom`, rejoins, receives several Lobby `state`
      updates, and is re-rendered with new callback functions each time. Exactly one transport is created and exactly
      one `rejoin` is sent.
- [ ] **Fresh join, same guarantee:** after a first-time `join` (no stored identity), later Lobby `state` updates and
      re-renders never create another transport or send a `rejoin`.
- [ ] **In-flight rejoin is abandoned:** unmounting `JoinRoom` (or changing the Room Code) while a rejoin is still
      connecting closes that transport, and a reply that arrives afterwards does not change any state.
- [ ] **Joined connection survives unmount:** unmounting `JoinRoom` after a successful join (as happens when the Guest
      moves to `/play`) does not close the transport, and later `state` messages still reach `onGameState`.
- [ ] Each test fails if the matching part of the fix is reverted (confirmed once by hand while writing the test).
- [ ] A convention in `docs/conventions/` says when to write a component test and when to write a pure unit test.
- [ ] The room-lifecycle `SPEC.md` Testing Decisions points to this slice for component-wiring tests.
