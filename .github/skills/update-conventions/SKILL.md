---
name: update-conventions
description: Document or update a project convention in docs/conventions/ — use when the conversation settles on a new coding/testing/architectural convention, revises an existing one, or the user asks to write one down.
---

# Update Standards

Capture project conventions as quick-reference standards under `docs/conventions/`, so future work (human or agent) can
look up "how do we do X here" without re-deriving it from a conversation.

## Process

1. **Find the topic file.** Scan `docs/conventions/*.md` file headings (`# <Topic>`) for the one whose subject matches
   the convention under discussion. Topic filenames are kebab-case: `docs/conventions/<topic>.md`.

2. **Decide the action:**
   - The convention is already documented under a `## <Convention name>` heading in that file → **update** that section.
   - The topic file exists but doesn't cover this convention yet → **add** a new `## <Convention name>` section to it.
   - No topic file covers this subject → **create** `docs/conventions/<topic>.md`.

3. **Check for conflict.** If the convention contradicts what's already written (rather than merely extending it),
   stop and ask the user which version should stand before touching the file. Extending existing content needs no
   check; contradicting it always does.

4. **Write the standard**, following the shape below.

5. **Reassess the file.** After writing, if the topic file has become hard to scan as one document, split it into
   focused `docs/conventions/<topic>-<subtopic>.md` files along natural sub-topic boundaries. No fixed count or length
   triggers this — judge it the way a reader landing on the file cold would.

## Standard shape

- File heading: `# <Topic>` — one per topic file.
- Standard heading: `## <Convention name>` — one per convention; a topic file holds as many as its subject needs.
- Description: a short paragraph, a few sentences stating the rule and why it exists — not a tutorial.
- Code example: optional, under 10 lines, only when it clarifies faster than the prose alone.
- Self-contained: state the rule inline rather than pointing elsewhere — no links to ADRs, the domain glossary, or
  other standards, even where relevant prior art exists.
- Preserve existing wording that the new content doesn't conflict with.
