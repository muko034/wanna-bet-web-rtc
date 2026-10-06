# Transport

## Defer closing a Transport after a final message

When a side sends a last message the peer must receive and then closes its `Transport` (a Guest's Sit out, the Host's Leave broadcasting a `state` with `status: 'ended'`), close from a `setTimeout` instead of in the same tick. An immediate close tears the connection down before the message leaves, so the peer never sees it. Name the delay as a `*_CLOSE_DELAY_MS` constant at the top of the module, per the usual constants rule.

```ts
const SIT_OUT_CLOSE_DELAY_MS = 200;

new GuestProtocol(transport).sitOut();
setTimeout(() => transport.close(), SIT_OUT_CLOSE_DELAY_MS);
```
