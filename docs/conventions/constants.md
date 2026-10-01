# Constants

## Name literal tunables as module-level constants, with a unit suffix

Timeouts, delays, limits, and storage-key prefixes become `SCREAMING_CASE` constants declared at the top of the
module that uses them, not inline literals. Durations carry their unit in the name (`_MS`) and use numeric separators
for readability. A named constant says what the number means and gives one place to tune it.

```ts
const CONNECT_TIMEOUT_MS = 8_000;
const REOPEN_RETRY_DELAY_MS = 3_000;
```
