# /learn

**Owner:** concierge
**Purpose:** Capture a project-specific or global lesson into `Artifacts/LEARNINGS.md` or `GLOBAL_INBOX.md`.

## Flags
- `--global`: If specified, the lesson is written to the central `ai-code-settings` repository's `Artifacts/GLOBAL_INBOX.md` for later graduation instead of the local project's learnings.

## Trigger
- User runs `/learn` with a description (and optional `--global` flag)
- User says "remember this", "don't do that again", or similar intent
- Concierge identifies a candidate during `/handoff`

## Procedure

1. **Parse** the lesson from user input or recent context
2. **Classify** into category: `mistake` | `preference` | `gotcha` | `workflow` | `pattern`
3. **Target Selection**:
   - **Local (Default)**: Use `Artifacts/LEARNINGS.md` in the current project root.
   - **Global (`--global`)**: Use `c:\Users\44547\source\repos\ai-code-settings\Artifacts\GLOBAL_INBOX.md`.
4. **Check for duplicates** — grep target file for similar entries. If exists, update instead of append.
5. **Append** to the target file using entry format:
   ```
   ### [YYYY-MM-DD] category: Short title
   Description of what to remember and why.
   ```
6. **Prune check (Local only)** — if entry count > 50:
   - Move oldest 10 entries to `Artifacts/history/learnings_archive.md`
   - Log pruning in session output
7. **Confirm** to user what was captured and where (local vs. global inbox)

## Examples

```
User: /learn always run `npm run build` before tests in this repo
→ ### [2025-01-15] gotcha: Run build before tests
    This repo requires `npm run build` before `npm test` — tests import from dist/.

User: /learn I prefer early returns over nested if blocks
→ ### [2025-01-15] preference: Early returns over nesting
    Use early return pattern. Avoid deeply nested conditionals.

User: don't do that again, the API needs snake_case not camelCase
→ ### [2025-01-15] mistake: API uses snake_case
    All API request/response fields use snake_case. Do not convert to camelCase.
```

## Edge Cases
- **No input provided**: Ask user what they want to remember.
- **Duplicate detected**: Show existing entry, ask if user wants to update or skip.
- **Artifacts/LEARNINGS.md doesn't exist**: Create it with a header.

## Artifacts/LEARNINGS.md Template (created on first `/learn`)
```markdown
# Learnings

Project-specific knowledge accumulated across sessions.
Categories: mistake, preference, gotcha, workflow, pattern

---
```