# Styling

## Prefix every class with `vb-`

Every CSS class in `src/index.css` and in the components starts with `vb-` (for example `vb-cta`, `vb-score-row`, `vb-bg-success`), so app styles are recognisable at a glance and cannot collide with anything else on the page. Name a new class after the block it styles, `vb-<block>`, and its parts `vb-<block>-<part>`.

## Express state variants as bare modifier classes on the base selector

A state variant of a block (chosen, positive, negative, yes/no) is a short unprefixed modifier class compounded onto the block's selector, such as `.vb-tapzone.chosen` or `.vb-delta.pos`. Apply it in JSX next to the base class instead of defining a separate prefixed sibling class, so the base styles stay in one place and the variant only overrides what differs.

```tsx
<span class={`vb-delta ${row.deltaClass}`}>{row.deltaLabel}</span>
```
