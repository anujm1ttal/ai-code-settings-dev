---
description: Triggers the scribe to generate or update project documentation. Supports tier selection and gates auditor completion checks.
---

# Command: /docs

Invokes the **scribe** agent. Scribe equips `skill-doc-updater.md`.

## Modes

- **`/docs`** (default): Auto-detect — staleness scan + coverage check → prioritized gap report → execute.
- **`/docs --internal`**: Tier 1 — `README.md`, `ARCH.md`, developer docs.
- **`/docs --user`**: Tier 2 — Quick Start guides, stakeholder docs.
- **`/docs --reference`**: Tier 3 — API docs, MCP schemas, DAX measure catalog.
- **`/docs --all`**: All three tiers in sequence.
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
- After strategist updates `IMPLEMENTATION_PLAN.md`, run `/docs --internal`.