# /learn

**Owner:** concierge
**Purpose:** Capture a project-specific lesson into `LEARNINGS.md`.

## Trigger
- User runs `/learn` with a description
- User says "remember this", "don't do that again", or similar intent

## Procedure

1. **Parse** the lesson from user input or recent context
2. **Classify** into category: `mistake` | `preference` | `gotcha` | `workflow` | `pattern`
3. **Check for duplicates** — grep `LEARNINGS.md` for similar entries. If exists, update instead of append.
4. **Append** to `LEARNINGS.md` using entry format:
   ```
   ### [YYYY-MM-DD] category: Short title
   Description of what to remember and why.
   ```
5. **Prune check** — if entry count > 50:
   - Move oldest 10 entries to `history/learnings_archive.md`
   - Log pruning in session output
6. **Confirm** to user what was captured

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
- **LEARNINGS.md doesn't exist**: Create it with a header.

## LEARNINGS.md Template (created on first `/learn`)
```markdown
# Learnings

Project-specific knowledge accumulated across sessions.
Categories: mistake, preference, gotcha, workflow, pattern

---
```