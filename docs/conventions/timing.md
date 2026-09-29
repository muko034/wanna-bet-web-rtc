# Timing

## Name every delay, timeout and retry budget as a module-level `_MS` constant

Declare each wait, timeout, TTL or retry cap as a `SCREAMING_SNAKE_CASE` constant at the top of the module that uses it, with the unit in the name (`_MS`) and a one-line comment saying what it waits for. Write large values with numeric separators or a product (`8_000`, `5 * 60_000`). Attempt counts sit beside them (`MAX_ATTEMPTS`). Keeping the numbers named and in one place lets a reader tune the behaviour without hunting through logic, and tests can assert the exact boundaries.

```ts
/** How long to wait for a confirming `state` before resending the Bet. */
const RETRY_INTERVAL_MS = 4_000;
const MAX_ATTEMPTS = 3;
```
