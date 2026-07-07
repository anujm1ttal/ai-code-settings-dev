---
description: Capture a project-specific or global lesson into Artifacts/learnings/ or GLOBAL_INBOX.md.
argument-hint: "[--global] <lesson>"
model: claude-haiku-4-5
---

# Command: /learn

**Target**: `$ARGUMENTS` → optional `--global` flag + `<lesson>` text.

**Owner:** concierge
**Purpose:** Capture a project-specific or global lesson into the hierarchical knowledge registry in `Artifacts/learnings/` or `GLOBAL_INBOX.md`.

## Flags
- `--global`: If specified, the lesson is written to the central `ai-code-settings` repository's `Artifacts/GLOBAL_INBOX.md` for later graduation instead of the local project's learnings.

## Trigger
- User runs `/learn` with a description (and optional `--global` flag)
- User says "remember this", "don't do that again", or similar intent
- Concierge identifies a candidate during `/handoff`

## Procedure

1. **Parse** the lesson from user input or recent context
2. **Classify** into category (subdirectory): `patterns` | `anti-patterns` | `project-notes` | `execution-rules`
3. **Target Selection**:
   - **Local (Default)**: Use the relevant subdirectory in `Artifacts/learnings/` (e.g., `Artifacts/learnings/patterns/`).
   - **Global (`--global`)**: Use the ai-code-settings repo's `Artifacts/GLOBAL_INBOX.md`.
4. **Check for duplicates** — grep target file for similar entries. If exists, update instead of append.
5. **Append** to the target file using entry format:
   ```
   ### [YYYY-MM-DD] category: Short title
   Description of what to remember and why.
   ```
6. **Prune check (Local only)** — if category entry count > 50:
   - Move oldest 10 entries to `Artifacts/History/`
   - Log pruning in session output
7. **Confirm** to user what was captured and where (local vs. global inbox)

## Examples

```
User: /learn always run `npm run build` before tests in this repo
→ Category: execution-rules
  ### [2025-01-15] execution-rules: Run build before tests
    This repo requires `npm run build` before `npm test` — tests import from dist/.

User: /learn I prefer early returns over nested if blocks
→ Category: patterns
  ### [2025-01-15] patterns: Early returns over nesting
    Use early return pattern. Avoid deeply nested conditionals.

User: don't do that again, the API needs snake_case not camelCase
→ Category: anti-patterns
  ### [2025-01-15] anti-patterns: API uses snake_case
    All API request/response fields use snake_case. Do not convert to camelCase.
```

## Edge Cases
- **No input provided**: Ask user what they want to remember.
- **Duplicate detected**: Show existing entry, ask if user wants to update or skip.
- **Artifacts/learnings/ doesn't exist**: Create the directory structure with an `index.md`.
- **Artifacts/learnings/HOT.md doesn't exist**: Create it (bootstrap) the first time an entry is
  referenced 3+ times across sessions, or on first `/handoff` Hot-Cache Refresh — seed with an
  empty table under a `# Hot Cache` heading. `/sync` reads this file first and falls back to
  category indexes if it is still missing.

## Artifacts/learnings/ index.md Template
```markdown
# Learnings Index

Project-specific knowledge accumulated across sessions.

| Category | Description |
|:---|:---|
| [Patterns](patterns/index.md) | Positive practices and success paths. |
| [Anti-Patterns](anti-patterns/index.md) | Mistakes and gotchas. |
| [Project Notes](project-notes/index.md) | Domain context and invariants. |
| [Execution Rules](execution-rules/index.md) | Mandatory guidelines. |
```