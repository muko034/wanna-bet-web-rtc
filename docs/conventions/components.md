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

## Build a confirmation dialog from the shared `vb-dialog` blocks

An irreversible action (leaving the Game, removing a Guest) is confirmed in a dialog made of the shared blocks: a
`vb-rank-sheet-backdrop vb-dialog-backdrop` wrapper whose click cancels, a `vb-dialog` panel with `role="dialog"` and an
`aria-label` that stops click propagation so taps inside don't reach the backdrop, then the buttons. The action button is
`vb-dialog-destructive`, the way out is a `vb-dialog-link` button, and a title (`vb-dialog-title`) is added when the
buttons alone don't say what is being confirmed. Reusing the blocks keeps every confirmation looking and dismissing the
same way.

```tsx
<div class="vb-rank-sheet-backdrop vb-dialog-backdrop" onClick={cancel}>
  <div class="vb-dialog" role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
    <button class="vb-dialog-destructive" type="button" onClick={confirm}>{t('hostMenu.remove')}</button>
    <button class="vb-dialog-link" type="button" onClick={cancel}>{t('homeDialog.cancel')}</button>
  </div>
</div>
```

## Render dialogs and sheets through `PhoneShell`'s `overlay` prop

A dialog or sheet (the Home dialog, the Leaderboard sheet, the Remove confirmation) is passed to `PhoneShell` as `overlay`, not rendered among its children. `overlay` sits after the stage and footer inside the phone frame, so the backdrop covers the whole screen, top bar included. Gate it on the component's open state (`open && <Dialog />`), so a closed dialog renders nothing.

```tsx
<PhoneShell background="vb-bg-lobby" overlay={removing && <RemoveGuestDialog name={removing.name} onConfirm={confirm} onCancel={cancel} />}>
```
