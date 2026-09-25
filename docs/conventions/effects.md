# Component effects

## Stash the latest callback props in a ref so an effect can depend on stable values alone

When an effect's dependency list should include a plain value (like a Room `code`) but not the callback props a
parent passes down, keep a `useRef` holding the latest callbacks, updated on every render, and read through
`ref.current` from inside the effect. A parent that passes a fresh callback identity on every render must not cause
the effect to re-run — each run has a real side effect (opening a new Peer connection) that shouldn't repeat just
because the parent re-rendered.

```ts
const callbacksRef = useRef({ onGameStarted, onGameState });
callbacksRef.current = { onGameStarted, onGameState };

useEffect(() => {
  // ...opens a connection...
  callbacksRef.current.onGameState(state);
}, [code]);
```

## Guard an in-flight async effect with a `pending` flag, and only cancel work still in flight

When an effect kicks off an async operation (a connection attempt) and then updates state or hands off a resource on
completion, track a local `pending` boolean and check it before acting once the promise resolves, so a re-run or
unmount doesn't apply a stale result. The cleanup function sets `pending = false` too, but only tears down the
resource (closing the transport) when the attempt is still in flight — once the attempt has succeeded, the resulting
connection is the live one the rest of the app now depends on and must outlive the effect.

```ts
useEffect(() => {
  const transport = new PeerJsTransport();
  let pending = true;
  attemptReconnect(transport, ...).then((result) => {
    if (!pending) return;
    pending = false;
    // ...apply result...
  });
  return () => {
    if (pending) {
      pending = false;
      transport.close();
    }
  };
}, [code]);
```
