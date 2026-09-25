You are orchestrating implementation of the issue. Track your progress.

## 1. Gather and validate context

Check the issue is not blocked by any other issue (`**Blocked by**`). If it is stop.

Check the issue is not already implemented (status `Implemented`/`Done`). If it is stop.

Resolve an optional specification - `SPEC.md` file in the same directory as the issue.

## 2. Prepare workspace

Check if you are on dedicated branch for the issue. If not, create a new branch named after the issue title (e.g.
`round-engine/05-single-round-happy-path`) and switch to it.

## 2. Implement with TDD

Spawn a fresh subagent and instruct it to invoke the `/tdd` skill. The subagent prompt must contain only:

- the absolute paths to the issue and, when present specification (or an explicit statement that no
  specification was found), with an instruction to read them first as the source of truth;
- the instruction to invoke the `/tdd` skill;
- the scope boundary and the reporting contract described below.

Do not summarize, paraphrase, or restate the issue or specification content (title, description, acceptance criteria,
etc.) in the subagent prompt — duplicating it risks drift.

The implementation subagent owns only implementation and tests. It does not own self-review, PR creation, ect. Require
it to report the exact test command (s) run with pass/fail evidence, the files changed, and any
blockers or insufficient-context findings.

Require the subagent to run the repository's relevant tests and report its result. Work is complete only when all tests
pass. If the subagent reports insufficient information, no changes, or tests still fail:

1. Commit the current state when there are changes, using `/commit`.
2. Comment on the issue with the failed phase, concise reason, evidence, and current repository state.
3. Stop without self-review or PR creation.

Completion criterion: the subagent reports a completed implementation, changes exist, and all required tests pass.

## 3. Self-review

Invoke `/two-axis-review` with `origin/main` as the fixed point. Review the complete `origin/main...HEAD` change and commit
range on both Conventions and Spec axes, using the fetched issue and specification as the originating requirements
(point to files paths).

Automatically fix every high-confidence correctness, security, test, or specification finding. Add focused follow-up
commits as needed and rerun the relevant tests. Rerun self-review only when a fix touched code beyond the originally
flagged lines; otherwise continue without rerunning it. Document unresolved judgment-call findings in the PR
description.

Completion criterion: relevant tests pass and no high-confidence review finding remains.

## 4. Capture recurring conventions

Spawn a fresh subagent to review the `origin/main...HEAD` change and capture any recurring convention it
established or reinforced that is not yet documented in `docs/conventions/`. Hand it only intent and
boundaries, not method or answers — do not enumerate the convention files or list patterns to look for, as
that biases a review whose value depends on fresh discovery. Its prompt must contain only:

- the worktree path and the instruction to start from `git log origin/main..HEAD` and `git diff origin/main...HEAD`;
- the rule that a pattern qualifies only if it recurs in at least two places, so the single-feature diff cannot
  prove it alone — confirm each candidate against the existing codebase before documenting;
- the boundary: read anything, write only under `docs/conventions/`, never touch code or tests;
- the action: for each qualifying convention invoke `/update-conventions` then `/commit` (issue key, type docs);
  otherwise make no changes and no commit;
- the reporting contract: which candidates were considered and why each did or did not qualify.

## 6. Create the pull request

Push the current branch and invoke `/create-pr`. Use its required `main` base. Extend the PR description with only the unresolved judgment-call findings from self-review, under a
single `## Unresolved judgment calls` section. Omit that section entirely when there are none.

Completion criterion: `create-pr` succeeds and a PR URL is available.

## Output

- The final output is the PR URL 
- Instructions to check it out locally `git fetch && git checkout <branch>`
- A summary of any unresolved judgment-call findings from self-review, if any.