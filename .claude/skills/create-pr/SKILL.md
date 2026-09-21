---
name: create-pr
description: Creates a GitHub Pull Request with an auto-generated summary using gh CLI.
---

Create a GitHub Pull Request using `gh pr create`.

## Behavior

1. Use `main` as the base branch (unless user states differently).
2. Fail and stop if:
    - there are uncommitted changes
    - current branch has no upstream / is not pushed
3. Build PR content:
    - **Title** must include issue key.
    - **Body** must include:
        - `## Summary` section with a concise summary (2-5 bullets) generated from:
            - `git diff --name-status "origin/main...HEAD"`
            - commit messages from `git log --no-merges --pretty=format:'- %s' "origin/main..HEAD"`
    - Do **not** include a "Changed files" section in the final body.
4. Create a **draft** PR.
5. Do not set reviewers, labels, or assignee automatically.

## Output

After success, print the PR URL returned by `gh pr create`.
