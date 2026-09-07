# When to Reach for a Test Double

Prefer the real dependency when it is fast, deterministic, isolated, and cheap. Reach for a double only at a
**system boundary** — where the real thing is:

- External, expensive, rate-limited, or unsafe to call (payment, email, third-party APIs)
- Slow or hard to provision
- Nondeterministic — time, randomness
- Hard to force into a required failure state
- Outside the behavior currently under test

Use the real thing for your own classes and modules, internal collaborators, and anything you control. Doubling
those is how tests become implementation-coupled.

## The vocabulary

- **Stub** — returns predetermined responses.
- **Fake** — a lightweight working implementation (an in-memory repository).
- **Spy** — records calls for later inspection.
- **Mock** — verifies predefined interactions.

Prefer stubs and fakes over interaction-heavy mocks unless the interaction itself is the contract.

An interaction assertion is justified when the interaction is externally meaningful — a payment must not be charged
twice, a message must publish only after a successful transaction, a retry must make no more than three attempts, an
authorization check must precede protected work. It is suspicious when it merely encodes the current internal call
structure.

## Designing for replaceable boundaries

**Inject dependencies.** Pass infrastructure into the code that uses it rather than constructing it inside business
logic.

Inject a boundary because it is a real boundary, not to satisfy a test — a double introduced only to observe your
own internal calls is the implementation-coupled anti-pattern wearing a seam's clothes.

**Prefer operation-specific adapters over one generic client.** Give each external operation its own method so tests
get a meaningful seam and setup needs no endpoint conditionals.

A generic HTTP client still earns its place behind these adapters for shared concerns — auth, retries, tracing,
serialization, error handling — but domain code should depend on the operation, not on URLs and HTTP details.
