# Constants

## Name literal tunables as module-level constants, with a unit suffix

Timeouts, delays, limits, and id or storage-key prefixes become `SCREAMING_CASE` constants declared at the top of the
module that uses them, not inline literals. Durations carry their unit in the name (`_MS`) and use numeric separators
for readability. A named constant says what the number means and gives one place to tune it, and a prefix shared by
a producer and a check (building an id, then recognising it) can't drift apart.

```ts
const PROBE_ID_PREFIX = 'link-probe-';
const PROBE_TIMEOUT_MS = 5_000;
```
