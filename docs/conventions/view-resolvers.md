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

## Resolve display summaries in sibling modules

When a screen needs UI-facing derived data from authoritative state, compute that shape in a pure sibling resolver instead of assembling names, labels, and point-change lists inline in the component. Use the resolver for small display summaries as well as control visibility so the component stays focused on JSX, callbacks, and local form state.

Keep the returned shape as small as the view needs and cover it with a focused unit test file beside the resolver.

```ts
export function resolveResolutionSummary(
  gameState: GameState | null,
): ResolutionSummary | null {
  // map GameState to display-ready copy here
}
```
