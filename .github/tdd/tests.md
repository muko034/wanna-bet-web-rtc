# Good and Bad Tests

## Good Tests

**Test through real interfaces, not mocks of internal parts.** Observe behavior a caller cares about, at the seam.

Characteristics:

- Tests behavior users/callers care about
- Uses the public interface only
- Survives internal refactors
- Describes WHAT, not HOW
- One logical behavior per test (which may need several assertions)

## Bad Tests

**Implementation-coupled**: bound to internal structure, so they break on a refactor that keeps behavior.

Red flags:

- Mocking internal collaborators
- Testing private methods
- Asserting incidental call counts or ordering
- Test breaks when refactoring without behavior change
- Test name describes HOW, not WHAT
- Verifying through a side channel instead of the interface

**Tautological**: the expected value is recomputed the way the code computes it, so the test passes by construction.

Use several carefully chosen examples when one could let a wrong implementation pass — cases that distinguish the
rules that matter: quantities, ordering, rounding, empty input, invalid input, boundary values.
