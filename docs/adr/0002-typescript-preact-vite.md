# TypeScript + Preact + Vite for the client

We chose TypeScript over plain JavaScript because the riskiest parts of this project — the payout math (non-zero-sum,
floor-protected point economy), the Host↔Guest message protocol, and the Host's persisted state-snapshot schema — all
benefit from typed contracts.

We chose Preact over React or vanilla JavaScript for the UI layer: it gives a component model at close to zero
bundle/runtime overhead, while staying API-compatible with React if we ever want to swap later — a low-cost, low-lock-in
choice given the project's small scope. Vite is the build tool/dev server for both.
