# Minimal UI

## Don't restate what the screen already shows

A heading or status label that only announces what the rest of the screen's content already makes obvious adds
nothing — cut it. Before adding one, check whether the buttons, cards, or form beneath it already convey the same
state; if removing the label loses no clarity, it doesn't belong.

```tsx
// Redundant: the judging buttons already say a decision is being made right now
<div class="vb-giant-title vb-title-small">Round in progress</div>
<div class="vb-giant-title vb-title-small">Did {name} pull it off?</div>
```

## Don't require confirmation for a foregone conclusion

When the state after an action is already fully determined by existing data — nobody actually has a decision left to
make — don't gate it behind a separate manual trigger (a button, a "waiting" screen). Advance automatically instead,
and reserve explicit confirmation for moments where a genuine decision is being made.

```ts
resolveRound(outcome);
startRound(); // the next Active Player is already determined — nothing left to confirm
```
