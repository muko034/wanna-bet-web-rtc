# Components

## Key every mapped list item by a stable id

Every `.map()` that renders JSX elements gives each element a `key` taken from a stable identifier of the item, such as `playerId` or the choice value, never the array index. Stable keys let the renderer keep the right DOM node and state attached to the right item when the list reorders, grows or shrinks (a roster changing as players join, a leaderboard re-sorting).

```tsx
{roster.map((entry) => (
  <div class="vb-avatar" key={entry.playerId}>
```

## Mark selected toggle buttons with `aria-pressed`

A button that picks one option out of a group (the YES/NO tap zones, the PL | EN language toggle) sets
`aria-pressed={isSelected}` on every button of the group, in addition to any visual modifier class. Assistive tech then
announces the selection, and a stylesheet may target `[aria-pressed='true']` when no shared modifier class exists.
