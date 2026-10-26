# Error handling

## Return expected refusals as data; throw only for broken preconditions

When a remote player's action can legitimately fail (a full Room, an unknown reconnect token, an invalid Bet), don't throw. Return the refusal as data: a `SCREAMING_SNAKE_CASE` reason code (a string-literal union when the set is closed), either as an optional field on the result or as a `rejected` reply to the sender. A refused action leaves state untouched, so return the unchanged state alongside the reason.

Throw `new Error(...)` only for caller bugs: a precondition the caller owns doesn't hold (placing a Bet before the game has started, starting a Room with no Guests). A player can't trigger these.

```ts
if (rejection) {
  return { state, payouts: [], rejection };
}
```

## Retry only a transient failure; never retry a definitive answer

When a call can fail because the other side didn't respond (transient) or because it gave a definite answer (an explicit rejection or error), retry only the transient case, with a bounded budget (attempt count or elapsed-time cap) and a short wait between attempts. Return or throw on anything else immediately: retrying an answer can't change it.

```ts
for (let attempt = 0; ; attempt++) {
  const result = await call();
  if (result.status !== 'no-response') return result; // success or definitive answer
  if (attempt >= MAX_ATTEMPTS) return result;         // budget exhausted
  await wait(RETRY_DELAY_MS);
}
```

## Let an optional browser API degrade, never break its feature

A browser capability the feature can live without (the clipboard, Wake Lock, Web Audio, device storage) is feature-detected
before use, and a call that can be refused is wrapped in `try`/`catch`. When the capability is missing or refuses, the
feature carries on: with a fallback where one exists (the clipboard falls back to `execCommand`), otherwise without it
(the Timer still counts down with no sound or screen lock). Nothing is surfaced to the player, and a swallowed failure
is either commented or logged with `console.warn`. Tests cover both the missing and the refusing case.

```ts
if (!active || !('wakeLock' in navigator)) return;
try {
  sentinel = await navigator.wakeLock.request('screen');
} catch {
  // A refused request just leaves the screen free to dim.
}
```
