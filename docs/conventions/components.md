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

## Open a dialog about one item by storing the item, not a boolean

A dialog that is about one specific item (removing a Guest, answering a Join Request) is opened by setting state to that
item, `null` when closed, and rendered only while it is set. The dialog then reads its title and callbacks from the stored
item, and it cannot be open without knowing which item it is about. A dialog with no subject (the Home dialog, the
Leaderboard sheet) keeps a plain boolean open flag.

```tsx
const [removing, setRemoving] = useState<{ playerId: string; name: string } | null>(null);

<button onClick={() => setRemoving({ playerId: entry.playerId, name: entry.name })}>
{removing && <RemoveGuestDialog name={removing.name} onCancel={() => setRemoving(null)} />}
```

## Key a single element by what it shows to get a fresh instance when that changes

Outside a list, an element's `key` is also a reset switch: when the key changes, the renderer discards the old instance
and mounts a new one. Give an element a key derived from what it is about, or from a counter bumped for each new
occurrence, when stale instance state must not carry over: a dialog keyed by the item it answers keeps typed input from
leaking to the next item, and a toast keyed by its id replays its CSS animation for every new notice.

```tsx
<JoinRequestDialog key={joinDialogFor} name={joinDialogFor} />
<div class="vb-toast" key={toast.id}>
```

## Name an icon-only button with `aria-label` and hide its SVG

A button or link that shows only an icon (the Exit link, the copy-invite button, the Redraw button, the Join Requests
bell) carries an `aria-label` that says what it does, and its inline `<svg>` is marked `aria-hidden="true"`. Assistive
tech then announces the label once instead of reading an unnamed graphic, and tests find the control by
`getByRole('button', { name })`.

```tsx
<button class="vb-bell" type="button" aria-label={label} onClick={onOpen}>
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
```

## Disable a submit control while its input is invalid, and check again in the handler

A button that commits typed or chosen input (Create, Join, Approve, Lock in) is `disabled` while the input is not valid,
and its handler returns early on the same condition. A form can still be submitted with the Enter key, and a disabled
button does not stop that. Derive the condition once, from a pure parse or validation function, and use it for both.

```tsx
const points = parseJoinPoints(pointsText);
<button disabled={points === null} onClick={() => points !== null && onApprove(points)}>
```
