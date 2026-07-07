---
description: Audit and update a CLAUDE.md against the OS quality bar (rules/common/claude-md-standards.md). Report-first; edits only on confirmation.
argument-hint: "[path-to-CLAUDE.md | --global]  (default: nearest project CLAUDE.md)"
model: claude-sonnet-5
---

# Command: /claude-md

**Target**: `$ARGUMENTS` → optional `[path]` or `--global`; defaults to nearest project `CLAUDE.md`.

**Owner:** auditor
**Purpose:** Score a CLAUDE.md against `rules/common/claude-md-standards.md`, report the
findings, and — only after explicit confirmation — apply targeted edits. Reuses the installed
`claude-md-management:claude-md-improver` plugin as the mechanism; this command supplies the
**OS-specific standard** the generic plugin lacks.

## Flags / Args
- `[path]` — target a specific CLAUDE.md. Default: the nearest project `CLAUDE.md`.
- `--global` — target the deployable global at `ai-code-settings/CLAUDE-global.md`.

## Trigger
- User runs `/claude-md` (optionally with a path or `--global`).
- An agent/command/skill/path was renamed or removed (stale-routing risk → dimension D4).
- A CLAUDE.md crossed its size target (§3 of the standard).

## Procedure

1. **Resolve target** — path arg, `--global` → `CLAUDE-global.md`, else nearest `CLAUDE.md`.
2. **Load the standard** — `rules/common/claude-md-standards.md` (the grading rubric).
3. **Classify tier** — global (`CLAUDE-global.md`) vs project. Applies the §2 split table and
   the matching §3 size caps.
4. **Score** — invoke `claude-md-management:claude-md-improver` graded against §4 (D1–D6,
   0–2 each) and scan for the §5 anti-patterns. Produce a report:
   - Per-dimension score + total (X/12), flagged anti-patterns, and each proposed edit.
   - **Verify routing currency (D4)**: every agent/command/skill/path named must still exist.
5. **Report first. Stop.** Present the scored report and the proposed diff. Do **not** edit yet.
6. **On explicit confirmation** — apply the approved edits only. Re-score to confirm the file
   now passes (≥10/12, no zeros).

## Hard Rules
- **Never auto-edit.** Steps 4–5 are report-only; edits apply only after the user confirms.
- **Reuse, don't rebuild.** Use the existing `claude-md-improver` plugin — no reimplemented scanner.
- **Respect the tier split.** Never move project-only content into the global (or vice versa)
  without surfacing it as a §2 Tier-bleed finding first.

## Examples

```
User: /claude-md
→ Scores ./CLAUDE.md against the standard: 11/12 (D5 actionability = 1: two narration lines).
  Proposes deleting them. Waits for confirmation.

User: /claude-md --global
→ Scores CLAUDE-global.md (global tier, ≤250-line cap). Flags a Stale-routing hit:
  command table lists a renamed command. Proposes the fix. Waits.
```
