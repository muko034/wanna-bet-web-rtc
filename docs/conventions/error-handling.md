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
