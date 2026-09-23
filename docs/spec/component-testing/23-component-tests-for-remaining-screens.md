**Blocked by**: 22 (Component test harness and `JoinRoom`)

## What to build

Using the harness from 22, cover the component wiring in the remaining screens that have effects, create connections,
or navigate. Static screens (`Home`, `JoinCode`'s form, `PhoneShell`, `NotFound`) are out of scope.

- **`StartedGame`**
  - Its effects: keeping the stored result memory in step with incoming Resolutions, redirecting to the Lobby, and
    resetting the bet form when a new Round starts.
  - One of its `useEffect` calls (the bet-form reset) sits after early `return`s, so the number of hooks can change
    between renders. This breaks Preact's rules of hooks. Write a test that moves the screen from a redirect or
    not-found state into the game, and fix the hook order if it fails.
- **`CreateRoom`**: give it the same optional transport factory as `JoinRoom`. Check that submitting creates one
  transport and passes the created Room and that transport to `onRoomCreated`, and that the button can't start a second
  create while one is running.
- **`App` wiring**
  - Callbacks passed to screens keep the same identity across re-renders where a screen depends on that.
  - A Host sees the Lobby at `/room/<CODE>` and a Guest sees the join form.
  - Starting the game takes the Host to `/play`.
  - A Guest's `placeBet` reaches its own transport, not the Host's `ConnectionManager`.

## Acceptance criteria

- [ ] `StartedGame` tests cover the Lobby redirect, the bet-form reset on a new Round, and a new Resolution showing on
      the frame it arrives.
- [ ] `StartedGame` calls the same hooks in the same order on every render, with a test that moves between views.
- [ ] `CreateRoom` accepts an optional transport factory (default `PeerJsTransport`). Tests check one transport per
      submit, the `onRoomCreated` arguments, and no double submit.
- [ ] `App` tests cover Host vs Guest routing at `/room/<CODE>`, the Host start-game navigation, and where a Guest's
      bet is sent.
- [ ] `App` tests check that callbacks a screen's effects depend on stay the same across re-renders caused by
      `state` updates.
- [ ] Every new test follows the component-testing conventions from 22 and asserts only on things visible from outside
      the component.
