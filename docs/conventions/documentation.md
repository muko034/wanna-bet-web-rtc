# Documentation

## Update the game rules doc in the same commit as a rule change

When a feature changes what players can do or what the Game does in response (a Host action, a new way to join, a changed cap), add or edit the matching bullet in `docs/game-rules.md` in that same commit. The doc is the plain-language statement of how the Game behaves, so a behaviour change that lands without it leaves the rules and the app out of step. Describe the rule a player or Host can rely on (who may do it, when, what happens next), not the code that implements it.

## Keep UI details out of the game rules doc

`docs/game-rules.md` states what the Game does: who may act, when, and what changes in the Game state. Do not add screens, buttons, sheets, toasts, layout, copy, or which screen shows what. Those belong in the code and its tests. A new UI-only feature needs no bullet there.
