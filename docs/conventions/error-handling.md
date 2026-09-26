# Error handling

## Return expected refusals as data; throw only for broken preconditions

When a request can legitimately fail because of what a remote player sent or did (a full Room, an unknown reconnect token, an invalid Bet), do not throw. Return the refusal as data: a `SCREAMING_SNAKE_CASE` reason code (typed as a string-literal union where the set is closed), surfaced either as an optional field on the result object or as a `rejected` reply to the sender. A refused action leaves state untouched, so return the unchanged input state alongside the reason.

Reserve `throw new Error(...)` for caller bugs, meaning a call made when a precondition the caller itself owns does not hold (placing a Bet before the game has started, starting a Room with no Guests). Those indicate a programming error, not something a player can trigger.

```ts
if (rejection) {
  return { state, payouts: [], rejection };
}
```

## Retry only a transient failure; never retry a definitive answer

When a call can fail either because the other side hasn't responded at all (a network blip, a slow peer — transient)
or because it gave a definite answer (an explicit rejection, a definite error), loop retrying only the transient
case, with a bounded budget (an attempt count or an elapsed-time cap) and a short wait between attempts. Any other
outcome, including a definite rejection, returns or throws immediately without consuming the wait: retrying an answer
the other side already gave can't change it.

```ts
for (let attempt = 1; ; attempt++) {
  const result = await rejoinRoom(transport, registry, code, token);
  if (result.status === 'joined') return result;
  if (result.status !== 'unreachable' || attempt >= RECONNECT_RETRY_ATTEMPTS) {
    return result;
  }
  await wait(RECONNECT_RETRY_DELAY_MS);
}
```
