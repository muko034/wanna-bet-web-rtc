# Documentation

## Update the game rules doc in the same commit as a rule change

When a feature changes what players can do or what the Game does in response (a Host action, a new way to join, a changed cap), add or edit the matching bullet in `docs/game-rules.md` in that same commit. The doc is the plain-language statement of how the Game behaves, so a behaviour change that lands without it leaves the rules and the app out of step. Describe the behaviour a player or Host can observe (who may do it, when, what happens next), not the code that implements it.
