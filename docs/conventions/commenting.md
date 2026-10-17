# Code Comments

## Let Code Speak

Write code that explains itself through structure and naming.

## Comment Sparingly

Add brief comments only when the logic isn't self-evident from the code.

## No Change Comments

Avoid comments about recent fixes or changes; comments should be timeless explanations, not changelogs. Don't reference
ADRs, tickets, or other docs from inline comments

## Open a role-specific prop's doc comment with `Host only:` or `Guest only:`

A prop that only one role ever calls or reads (`onPauseGuest`, `onRemoved`) gets a one-line doc comment that starts with `Host only:` or `Guest only:`, followed by what it does. A reader of a shared screen's props then sees which side drives each callback without tracing the call sites. Props both roles use carry no prefix.

```ts
/** Host only: removes the Guest `playerId` from the Game for good. */
onRemoveGuest: (playerId: string) => void;
/** Guest only: the Host removed this Guest from `code`'s Room, so the device must forget it. */
onRemoved: (code: string) => void;
```
