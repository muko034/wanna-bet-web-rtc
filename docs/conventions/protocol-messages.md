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
