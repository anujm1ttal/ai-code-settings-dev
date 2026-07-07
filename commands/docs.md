---
description: Triggers the scribe to generate or update project documentation. Supports tier selection and gates auditor completion checks.
argument-hint: "[--internal|--user|--reference|--all|--team] [filename]"
model: claude-haiku-4-5
---

# Command: /docs

**Target**: `$ARGUMENTS` → tier flag (`--internal`/`--user`/`--reference`/`--all`/`--team`) + optional `[filename]`.

Invokes the **scribe** agent. Scribe equips `doc-updater`.

## Modes

- **`/docs`** (default): Auto-detect — staleness scan + coverage check → prioritized gap report → execute.
- **`/docs --internal`**: Tier 1 — `README.md`, `Artifacts/ARCH.md`, developer docs.
- **`/docs --user`**: Tier 2 — Quick Start guides, stakeholder docs.
- **`/docs --reference`**: Tier 3 — API docs, MCP schemas, DAX measure catalog.
- **`/docs --all`**: All three tiers in sequence.
- **`/docs --team`**: Spawns 3 parallel scribes (Architect, UX, Technical) to document all three tiers simultaneously. If token limits are hit, falls back to `--all`.
- **`/docs [filename]`**: Update specific file.

## Auto-Detect Sequence
1. **Staleness Scan**: Doc timestamps vs. recent code changes. Flag stale ASCII diagrams.
2. **Coverage Check**: Undocumented MCP tools, DAX measures, Python modules, Rhino scripts.
3. **Gap Report**: Prioritized list.
4. **Execute**: Auto-update highest priority, or confirm scope if list is large.

## Gap Report Format

**Staleness**: Table of `File | Last Updated | Code Changed Since | Status`
**Coverage Gaps**: Table of `Component | Type | Missing Documentation`
**Priority Queue**: Numbered list, highest impact first.
**Recommended Action**: Auto-update / user confirmation / strategist coordination.

## Integration
- Stale docs block auditor `[x]` gates. Run `/docs` to unblock.
- After coder completes a task, run `/docs` to catch drift.
- After strategist updates `Artifacts/IMPLEMENTATION_PLAN.md`, run `/docs --internal`.