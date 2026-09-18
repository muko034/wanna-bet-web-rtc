# View resolvers

## Extract branching UI state into pure resolvers

When a screen has role-based or round-state branching, move that decision logic into a small sibling resolver module instead of piling conditionals into the component. The resolver should take plain data, return a discriminated union such as `kind` or `view`, and leave the component to rendering, local form state, and effects.

Keep the resolver easy to test on its own. Add a focused unit test file for each resolver so the branching rules stay stable as the UI grows.

```ts
export type BettingPanel =
  | { kind: 'hidden'; bettors: BettorStatus[] }
  | { kind: 'form'; bettors: BettorStatus[] };

export function resolveBettingPanel(params: Params): BettingPanel {
  // map GameState to render state here
}
```
