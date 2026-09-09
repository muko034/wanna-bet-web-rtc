# Challenges are drawn from a bundled Challenge Bank, not typed by the Host

We considered keeping the Host's free-text Challenge entry (the original `round-engine` spec) alongside a bank of
pre-written Challenges, but chose to replace free text entirely: every Round's Challenge is randomly drawn from a
fixed, bundled Challenge Bank (188 bilingual entries at launch, each with a `type`, `content`, informational
`timeLimit`, and optional Illustration), excluding whatever is already in the Room's Challenge History until the bank
is exhausted and the history resets. This removes typing friction for the Host, guarantees every Challenge already has
vetted Polish/English wording, and keeps the game's "good task" qualities (see `docs/game-rules.md`) consistent across
Rooms — at the cost of losing spontaneous, Host-invented Challenges, which is an explicitly accepted trade-off for v1.
`timeLimit` is carried as data but not enforced by the engine; an enforced countdown was considered and deferred as a
separate, later feature.
