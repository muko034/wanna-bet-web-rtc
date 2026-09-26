**Blocked by**: 24 (Guest resumes on page reload)

**Status**: Implemented

## What to build

Give the shared reconnect implementation from `24-guest-resumes-on-page-reload.md` a retry budget. Today a reconnect
attempt that gets no response at all from the Host (it's briefly unreachable, a slow network) fails on the first try.
Instead, it should retry automatically a small, fixed number of times with a short delay between attempts before
giving up.

If every attempt gets no response, the Guest sees a "can't reach the Host" state with a manual Retry button. Clicking
Retry re-invokes the same shared reconnect implementation, including its own retry budget — not a single bare
attempt.

An explicit rejection from the Host (e.g. an unrecognized identity) is a different case, already handled by
`24-guest-resumes-on-page-reload.md`'s fallback to the join form — it must never be retried by this budget, since
retrying an answer the Host already gave can't change the outcome. Only "no response at all" counts toward the retry
budget.

While a reconnect attempt (automatic or manual) is in progress, the Guest sees a dedicated "Reconnecting…" state, not
a stale game/lobby screen.

## Acceptance criteria

- [x] A reconnect attempt that gets no response from the Host retries automatically (a small fixed number of times,
      with a short delay between attempts) before anything is shown as failed.
- [x] If every automatic attempt gets no response, the Guest sees a "can't reach the Host" state with a manual Retry
      button.
- [x] Clicking Retry repeats the same automatic-attempts-then-manual-fallback behavior, not a single bare attempt.
- [x] An explicit rejection from the Host is never retried by this budget — it's treated as final immediately.
- [x] A dedicated "Reconnecting…" state is shown for the duration of any reconnect attempt, automatic or manual.
