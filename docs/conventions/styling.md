# Styling

## Prefix every class with `vb-`

Every CSS class in `src/index.css` and in the components starts with `vb-` (for example `vb-cta`, `vb-score-row`, `vb-bg-success`), so app styles are recognisable at a glance and cannot collide with anything else on the page. Name a new class after the block it styles, `vb-<block>`, and its parts `vb-<block>-<part>`.

## Express state variants as bare modifier classes on the base selector

A state variant of a block (chosen, positive, negative, yes/no) is a short unprefixed modifier class compounded onto the block's selector, such as `.vb-tapzone.chosen` or `.vb-delta.pos`. Apply it in JSX next to the base class instead of defining a separate prefixed sibling class, so the base styles stay in one place and the variant only overrides what differs.

```tsx
<span class={`vb-delta ${row.deltaClass}`}>{row.deltaLabel}</span>
```

## Adjust a reused block from its container with a descendant selector

When a block is reused inside a layout container and needs a different margin or padding there, override only the difference with a selector scoped to the container, such as `.vb-bettor-pills .vb-status-pill`, `.vb-task-title .vb-task-label` or `.vb-bet-form .vb-tapzone`. Do not fork the block into a new class or a variant: the base block keeps its standalone look, and the container owns how its children sit inside it.

```css
.vb-bettor-pills .vb-status-pill {
  margin-bottom: 0;
}
```
