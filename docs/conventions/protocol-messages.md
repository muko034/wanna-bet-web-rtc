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

## Wrap ongoing Host messages in `watch*` helpers

A Guest reacts to an ongoing Host message (state, game start, Bet rejection, connection drop) through an exported `watch*` function beside the other Guest join helpers. It takes a `Transport` and a plain callback, subscribes via `GuestProtocol`, and passes the callback only the data it needs. Wire it in `wireGuestConnection` with a matching field on `ReconnectCallbacks`, so join, rejoin and reconnect all get it. Components never touch the protocol object. Handle one-shot replies to a Guest's own request (such as `welcome`) where the request is sent, not in a `watch*`.

```ts
export function watchForBetRejection(transport: Transport, onBetRejected: (reason: BetRejection) => void): void {
  const protocol = new GuestProtocol(transport);
  protocol.on('rejected', (payload) => {
    if (payload.action === 'placeBet') onBetRejected(payload.reason);
  });
}
```

## Update the wire protocol doc in the same commit as a wire-shape change

When a message, payload, or `Player`/`GameState` field is added or changed in `src/protocol/messages.ts`, update `docs/message-protocol.md` in that same commit: the message tables, the type listing, and any notes on behaviour. The doc is the reference Guests and Hosts are built against, so a wire change that lands without it leaves the two out of step.
