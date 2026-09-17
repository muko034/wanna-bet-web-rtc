---
name: commit
description: 'Generate conventional commit messages. Use when you want commit changes.'
---

### Instructions

This file contains a prompt template for generating conventional commit messages. It provides instructions,
examples, and formatting guidelines to help users write standardized, descriptive commit messages in accordance with
the Conventional Commits specification.

### Workflow

1. Inspect changes. Run `git diff` or `git diff --cached`.
2. Stage your changes with `git add <file>`.
3. Construct your commit message using the following XML structure, prefixing the description with the issue key.
4. Commit changes with the generated message.

### Commit Message Structure

```xml
<commit-message>
  <type>feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert</type>
  <scope>()</scope>
  <description>A short, imperative summary of the change</description>
  <body>(optional: more detailed explanation)</body>
  <footer>(optional: e.g. BREAKING CHANGE: details, or issue references)</footer>
</commit-message>
```

### Validation

- type: Must be one of the allowed types. See [Conventional Commits Specification](conventional-commits-spec.md).
- scope: Optional, but recommended for clarity.
- description: Use the imperative mood for the summary (e.g., "add", not "added").
- body: Optional. Use for additional context. Concise bullet points.
- footer: Use for breaking changes or issue references.
