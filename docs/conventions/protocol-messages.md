# Protocol messages

## Define wire shapes once with Zod and derive the TypeScript types

Model the Host↔Guest wire protocol in `src/protocol/messages.ts` with one Zod schema for each reusable payload shape and each message envelope, then export the TypeScript types with `z.infer`. Do not hand-write a separate `type` or `interface` that duplicates a schema's structure, because the parser and the static types must stay in lockstep.

When a new message or nested payload appears, factor it into a named sub-schema and compose it into the larger schema so both validation and reuse stay explicit.

```ts
const payoutSchema = z.object({
  playerId: z.string(),
  amount: z.number(),
});

export type Payout = z.infer<typeof payoutSchema>;
```

## Expose each inbound message as a `watch*` helper that hands the UI a plain callback

To react to a Host message, add a small exported `watch*` function beside the other Guest join helpers. It takes a `Transport` and a plain callback, subscribes through `GuestProtocol`, filters to the messages it cares about (for example a `rejected` with a given `action`), and passes the callback only the data it needs. Wire it in `wireGuestConnection` with a matching field on `ReconnectCallbacks`, so every connection path (join, rejoin, reconnect) gets the same subscription and components never touch the protocol object.

```ts
export function watchForBetRejection(transport: Transport, onBetRejected: (reason: string) => void): void {
  const protocol = new GuestProtocol(transport);
  protocol.on('rejected', (payload) => {
    if (payload.action === 'placeBet') onBetRejected(payload.reason);
  });
}
```
