# Wanna Bet Rules

## Goal
Each round, players try to predict whether the active player will succeed at a challenge. The goal is to keep the most points by making smart bets and surviving the round sequence.

## Setup
- The game starts with at least two players.
- Each player begins with the same starting amount of points (100).
- One player is designated as the active player for the current round.

## Round flow
1. A challenge is presented to the active player.
2. The other players choose whether they believe the active player will succeed or fail.
3. Each non-active player places a bet with a chosen amount and a YES/NO prediction.
4. The active player does not place a bet.
5. After all bets are placed, the challenge is resolved.
6. The outcome is applied to all player scores.
7. The active player rotates to the next player, and a new round begins.

## Betting rules
- Players may only bet up to half of their current points (rounded down), with a minimum bet of 1.
- A player with exactly 1 point may still bet their full 1 point, as an exception to the half-of-points cap.
- Bets are made only by non-active players.
- A bet includes:
    - amount
    - prediction: YES or NO

## Resolution rules
- The challenge is judged as either successful (YES) or unsuccessful (NO).
- Payouts are independent per player, not drawn from a shared pool — the game is **not** zero-sum; points can be created or removed from the game entirely.
- If the outcome is YES:
    - Players who predicted YES gain their bet amount.
    - Players who predicted NO lose their bet amount.
    - The active player gains the sum of what the NO-predicting players lost.
- If the outcome is NO:
    - Players who predicted NO gain their bet amount.
    - Players who predicted YES lose their bet amount.
    - The active player's points do not change.
- No player's points can ever drop below 1 as a result of a bet.

## Winning and losing
- Players keep playing until the game is ended.
- The winner is the player with the highest point total when the game ends.
- A player can lose points if they make an incorrect prediction; the active player never loses points directly from a round's resolution, only bettors do.

## Player status
- The host may pause a player, skipping them from betting and rotation until resumed, or remove a player from the game entirely.
- There is no automatic skipping for a disconnected player — a round waits for them unless the host pauses or removes them.

## Game ending
- The game ends when the host or the group decides the session is over.
- The session may also end when no further rounds are desired or the game is manually stopped.

## A good task

A good task is one that is:
- Clear and binary: success/failure is obvious to everyone.
- Short and repeatable: easy to judge in a few seconds or under a minute.
- Observable: everyone can see whether the challenge was completed.
- Fair and understandable: no hidden rules, no subjective grading.
- Socially fun: simple, playful, and slightly risky without being dangerous.
- Balanced: strong enough to create tension, but not so hard that most bets are pointless.
- Low ambiguity: “did they complete it?” should be answerable without arguments.