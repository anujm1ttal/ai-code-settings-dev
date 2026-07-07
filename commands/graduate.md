---
description: Triage cross-project learnings from GLOBAL_INBOX.md into global rules, skills, or standards.
argument-hint: ""
model: claude-haiku-4-5
---

# Command: /graduate

**Owner:** concierge
**Purpose:** Triage cross-project learnings from `GLOBAL_INBOX.md` into the correct global rules, skills, or standards files.

## Trigger
- User runs `/graduate` while working in the `ai-code-settings` repository

## Precondition
- Must be run from the `ai-code-settings` workspace (not a project repo)
- `Artifacts/GLOBAL_INBOX.md` must exist and contain at least one entry

## Procedure

1. **Read** `Artifacts/GLOBAL_INBOX.md`
2. **For each entry**, determine the correct destination:

   | Pattern Category | Destination File |
   |:---|:---|
   | Python coding patterns | `rules/common/coding-style.md` → Python section |
   | Interaction / behavioral | `rules/common/standards.md` |
   | Agent routing / lifecycle | `rules/common/orchestration.md` |
   | Security | `rules/common/security.md` |
   | Domain-specific (Rhino, PBI, DAX) | Relevant `skills/*/SKILL.md` → gotchas section |
   | Tool-wide (global OS behavior) | `CLAUDE-global.md` (the deployable global; deploy.sh pushes it to `~/.claude/CLAUDE.md`) — mirror the same entry into `GEMINI.md` since it is not auto-deployed |

3. **Present** each entry to the user with the proposed destination and wording
4. **User decides**: `accept` | `edit` | `skip` | `delete`
5. **Apply** accepted entries:
   - Append to the destination file in the appropriate section
   - If the destination file has no "Gotchas" or equivalent section, create one
6. **Remove** graduated entries from `GLOBAL_INBOX.md`
7. **Report** summary: N graduated, N skipped, N deleted, N remaining

## Entry Format in Destination Files

Entries should be integrated naturally into the target file's existing format:
- **Rules files**: Add as a bullet point in the relevant section
- **Skills files**: Add under a `## Known Gotchas` or `## Common Pitfalls` section
- **CLAUDE-global.md/GEMINI.md**: Add as a bullet in the relevant section (mirror into both — GEMINI.md is not deployed automatically)

## Edge Cases
- **Empty inbox**: Report "No entries to graduate" and exit
- **Ambiguous destination**: Ask user where it should go
- **Duplicate in destination**: Show existing content, ask user whether to merge, update, or skip
- **Wrong workspace**: Block execution — report "This command must be run from ai-code-settings"

## Example

```
Inbox entry:
  ### [2026-04-09] gotcha: Circular imports in validation layers
  Schema models must not import from service modules. Use TYPE_CHECKING guards.

Proposed:
  → rules/common/coding-style.md § Python (3.12+) section
  Wording: "- **Circular Imports**: Schema/model modules must NOT import from
            tool-registration or service modules. Use TYPE_CHECKING guards."

User: accept
→ Appended to coding-style.md, removed from inbox.
```
