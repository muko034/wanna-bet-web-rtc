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
export function resolveResultScreen(
  { memory, localPlayerId }: Params,
): ResultScreen | null {
  // map GameState to display-ready copy here
}
```

## Let resolvers own the absent-input fallback

Type resolver params to accept the values a component may not have yet, such as a `null` game state, room, or local player id, and have the resolver return its own `hidden` variant or `null` for them. The component passes its raw values straight in instead of pre-guarding the call or hand-building a placeholder result, so the fallback is defined and tested in one place.

```ts
export function resolveRoundControls({ code, room, gameState }: Params): RoundControls {
  if (!code || !room || room.code !== code || !gameState) {
    return { kind: 'hidden' };
  }
  // ...
}
```

## Let resolvers pick the screen background

When a resolver's variants map to a different screen background, put the `vb-bg-*` class name in the returned shape and type it as a string-literal union (or a single literal on a variant that has only one). The component passes it straight to `PhoneShell` instead of choosing a background from `kind` itself, so the mapping from state to look stays in the unit-tested resolver.

```ts
| { kind: 'judge-round'; challengerName: string; background: 'vb-bg-judge' }
```

## Mark the local player's row in the resolver

When a resolver returns per-player rows, have it identify the local player instead of leaving that to the component. Build `nameLabel` with a "(you)" suffix for the local player's own row, and expose a boolean flag such as `isLocal` when the view needs to style or find that row. The component never compares `playerId` against the local id or matches the "(you)" text, so the rule is defined and tested in one place.

```ts
const isLocal = player.playerId === localPlayerId;
return { nameLabel: isLocal ? `${player.name} (you)` : player.name, isLocal };
```

## Map a closed union to display data with a `Record` lookup table

When a closed string union (a status, a time limit, a result code) maps to labels, messages, or view fragments, declare a module-level `Record<Union, ...>` table and index it, instead of an if/switch chain. The compiler then rejects the table until every member of the union is mapped, so adding a variant cannot silently fall through to missing copy. Use `Exclude<...>` in the key type to drop members that never reach the table.

```ts
const ERROR_MESSAGES: Record<Exclude<JoinResult['status'], 'joined'>, string> = {
  'room-full': 'This Room is already full (20 players).',
  // ...
};
```
