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

## Clear an effect's timer in its cleanup

When an effect starts a `setTimeout` or `setInterval`, keep the handle in a local `const` and clear it in the returned
cleanup. A re-run or unmount then can't fire a stale callback that sets state for a view that has moved on.

```ts
useEffect(() => {
  if (!copied) return;
  const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  return () => clearTimeout(timer);
}, [copied]);
```

## Extract a timer or listener effect into a `use-<name>.ts` hook beside the component

An effect that owns a timer, an interval or a document listener, together with the state it drives, moves out of the
component into a hook file in the same folder, named in kebab-case `use-<name>.ts` and exporting `use<Name>`
(`use-toasts.ts`, `use-link-lost-duration.ts`, `use-foreground-retry.ts`). The hook sets up and tears down everything it
starts, so the component only calls it and renders what it returns. The screen stays readable, and the timing logic is
named and kept in one place.

```ts
// use-link-lost-duration.ts
export function useLinkLostDuration(lost: boolean, now: () => number = Date.now): number | null {
```

## Set browser state before the first render when a screen replaces the `Router`

`route()` does nothing while another screen is rendered in place of the `Router`. If the app must change the URL for a
screen that takes over the `Router` (reopening a saved Room at its own link), call `window.history.replaceState`
before the first render, in the code that decides to show that screen. Doing it later, from an effect or after the
screen finishes, leaves the old URL in place.

```ts
window.history.replaceState(null, '', withBase(autoResume.landingPath));
return { ...autoResume, failed: false };
```
