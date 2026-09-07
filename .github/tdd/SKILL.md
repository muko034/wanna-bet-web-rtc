---
name: tdd
description: Test-driven development. Use when the user wants to build a feature test-first, fix a bug with a regression test written first, or explicitly asks for TDD or red-green-refactor.
---

# Test-Driven Development

TDD is the red → green loop: write a failing test, then only the code that turns it green. This skill keeps that loop
producing tests worth keeping — where tests go, what a good one looks like, and the anti-patterns that make a test
worthless despite passing. Consult it before you write each test, not after.

When exploring the codebase, read `docs/domain-glossary.md` (if it exists) so test names and interface vocabulary match
the project's domain language, and respect ADRs in the area you're touching and existing conventions.

## Seams — where tests go

A **seam** is a boundary stable enough to test against without coupling to how the code behind it works today: a public
API, a module's exported function, a repository against a test database, a pure function with real logic of its own.
Test at the narrowest seam that represents the behavior on its own — narrow when a pure function captures the rule
cleanly, wider when the behavior only exists once collaborators are wired together (a checkout flow, an HTTP handler).

Use the seam the codebase already gives you. Ask the user only when the seam is genuinely undecided: a new interface
being designed, a refactor that's moving the boundary, or two equally plausible seams with no precedent in the codebase.
Otherwise infer it and proceed — the code already answered the question.

See [tests.md](tests.md) for what a good test at a seam looks like, and [mocking.md](mocking.md) for when to reach for a
test double instead of the real collaborator.

## Anti-patterns

- **Tautological** — the assertion recomputes the expected value the way the code does (a total summed the same way the
  production code sums it, a hand-derived snapshot, a constant asserted equal to itself), so it passes by construction
  and can never disagree with the code. Expected values need an independent source of truth: a known-good literal, a
  worked example, the spec.
- **Horizontal slicing** — writing all tests first, then all implementation. Bulk tests verify _imagined_ behavior:
  you test the shape of things instead of what callers observe, and you commit to test structure before the
  implementation has taught you anything. Work in **vertical slices** instead — one test → one implementation → repeat,
  each test a **tracer bullet** that responds to what the last cycle taught you.

## Rules of the loop

- **Red before green.** Write the failing test first, then only enough code to pass it — done when the suite is green
  and nothing beyond the test's behavior was added.
- **One slice, one rule.** A slice is one behavioral rule, and one rule can span several cases — a parser's valid,
  malformed, and empty inputs are one rule with three examples, not three cycles. Group cases into one parameterized
  test when they specify the same rule; split them when they don't.
- **Refactor inside the cycle, small.** Once green, clean up the code you just touched — rename, extract, dedupe (if
  needed) — before starting the next slice. Save larger, structural refactors that reach beyond the current slice for a
  later stage.
