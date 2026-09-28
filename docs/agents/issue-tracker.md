# Issue Tracker

Specs and tasks live in GitHub Issues of this repo, managed with the `gh` CLI.

## Model

- **Spec** = an issue labeled `spec`. Its body follows the spec template from the `to-spec` skill.
- **Task** = an issue labeled `ready-for-agent`, created as a **sub-issue** of its spec. Its body follows the task
  template from the `to-tasks` skill (What to build + Acceptance criteria).
- **Blocking** between tasks is a native GitHub "blocked by" dependency. Do not write `Blocked by` lines in the body.
- Titles are plain names, with no number prefix.

## Skill vocabulary mapping

| Skill term    | GitHub                                  |
| ------------- | --------------------------------------- |
| `summary`     | issue title                             |
| `description` | issue body                              |
| `labels`      | issue labels                            |
| `parent`      | sub-issue link to the spec              |
| `blocked_by`  | native "blocked by" dependency          |

## Recipes

Sub-issue and dependency calls take the issue **id**, not the number.

```bash
# Create (prints the issue URL)
gh issue create -t "<title>" -F body.md -l spec              # spec
gh issue create -t "<title>" -F body.md -l ready-for-agent   # task

# Link a task to its spec (sub-issue)
gh api -X POST repos/{owner}/{repo}/issues/<spec#>/sub_issues \
  -F sub_issue_id=$(gh api repos/{owner}/{repo}/issues/<task#> --jq .id)

# Mark a task as blocked by another
gh api -X POST repos/{owner}/{repo}/issues/<task#>/dependencies/blocked_by \
  -F issue_id=$(gh api repos/{owner}/{repo}/issues/<blocker#> --jq .id)

# Read
gh issue view <n>
gh api repos/{owner}/{repo}/issues/<spec#>/sub_issues --jq '.[] | "#\(.number) \(.title) [\(.state)]"'
gh api repos/{owner}/{repo}/issues/<task#>/dependencies/blocked_by --jq '.[].number'
gh issue list -l spec
```

Create blockers before the tasks they block, so the dependency can reference real issue ids.

## Working on a task

- Branch: `<issue#>-<slug>`. Commit scope: `#<issue#>`.
- The PR description contains `Closes #<task#>` for the task only, never for the spec.
