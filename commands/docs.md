---
description: Triggers the scribe agent to generate or update project documentation. Supports tier selection for targeted output. Gates auditor completion checks.
---

# Command: /docs

This command invokes the **scribe** agent to generate, update, or audit project documentation. It is the missing link that ensures the `auditor` can verify documentation gates before marking tasks complete.

## ⚡ Execution Modes

### Auto-Detect (Default)
When `/docs` is run without arguments, the scribe scans for documentation gaps:

1. **Staleness Scan**: Compare documentation timestamps against recent code changes.
   - `ARCH.md` last modified vs. latest `IMPLEMENTATION_PLAN.md` changes.
   - `README.md` last modified vs. latest `src/` changes.
   - Inline ASCII diagrams vs. adjacent code modifications.
2. **Coverage Check**: Identify undocumented components:
   - MCP tools without input/output schema docs.
   - DAX measures without catalog entries.
   - Python modules without docstrings.
   - Rhino scripts without usage notes.
3. **Gap Report**: Output a prioritized list of documentation tasks.
4. **Execute**: Update the highest-priority items automatically, or ask the user to confirm scope if the list is large.

### Tier Selection
Target a specific documentation tier:

- **`/docs --internal`**: Tier 1 — Update `README.md`, `ARCH.md`, and developer-facing docs.
- **`/docs --user`**: Tier 2 — Generate or update Quick Start guides and stakeholder-facing docs.
- **`/docs --reference`**: Tier 3 — Auto-generate API docs, MCP tool schemas, or DAX measure catalogs.
- **`/docs --all`**: Run all three tiers in sequence.

### Targeted Update
Specify a file or component directly:

- **`/docs README.md`**: Update only the README.
- **`/docs ARCH.md`**: Sync architecture docs with current `IMPLEMENTATION_PLAN.md`.
- **`/docs [filename]`**: Update or create documentation for a specific source file or module.

## 🔍 Documentation Standards

The scribe equips `skill-doc-updater.md` and enforces these rules:

### Content
- **Telegraphic**: Bullets, tables, bold text. No conversational filler.
- **Constraint-Based**: Every feature section must include a "Limitations" or "What this CANNOT do" subsection.
- **Visual-First**: Include ASCII diagrams for data flow, branching logic, and state machines. Diagrams must stay current.

### Structure
- **README.md**: Project overview → Quick Start → Dependencies → Environment Setup → Usage → Limitations.
- **ARCH.md**: System overview → Component map → Data flow → Key decisions → Constraints.
- **API / MCP Docs**: Tool name → Description → Input schema → Output schema → Error codes → Example.
- **DAX Catalog**: Measure name → Purpose → Dependencies → Formula → Example output.

### Freshness
- Documentation referencing modified code is flagged as **stale**.
- Stale docs block `auditor` completion gates — the task cannot be marked `[x]` until docs are current.
- ASCII diagrams adjacent to modified code MUST be updated in the same pass.

## 📋 Gap Report Format

### Documentation Gap Report — [Date/Timestamp]

**Staleness**:
| File | Last Updated | Code Changed Since | Status |
| :--- | :--- | :--- | :--- |
| `README.md` | [date] | [yes/no] | [Current / Stale] |
| `ARCH.md` | [date] | [yes/no] | [Current / Stale] |

**Coverage Gaps**:
| Component | Type | Missing Documentation |
| :--- | :--- | :--- |
| [module/tool/measure] | [Python / MCP / DAX / C#] | [What's missing] |

**Priority Queue**:
1. [Highest impact gap — what to fix first]
2. [Second priority]
3. [Third priority]

**Recommended Action**: [Auto-update / User confirmation needed / Scribe + Strategist coordination required]

## 🔗 Integration

### With the Auditor
- The `auditor` gates task completion on documentation being current.
- When the `auditor` flags "Documentation" as a failing gate, run `/docs` to resolve it.
- After `/docs` completes, the `auditor` re-evaluates the documentation gate.

### With the Coder
- After the `coder` completes a task, `/docs` should be run to catch any documentation drift.
- The `coder` is NOT responsible for documentation — that is the `scribe`'s job.

### With the Strategist
- When the `strategist` updates `IMPLEMENTATION_PLAN.md` or `ARCH.md` structure, `/docs --internal` ensures the scribe reformats and clarifies.
- `BRD_SUMMARY.md` updates are triggered when the `strategist` revises project scope.

### With /sync
- `/sync` detects stale documentation as part of its State File Health check.
- If `/sync` flags doc staleness, it recommends running `/docs` as the next step.

## 💬 Example Usage

> **User**: /docs
>
> **Scribe**:
> ### Documentation Gap Report — 2026-03-15
>
> **Staleness**:
> | File | Last Updated | Code Changed Since | Status |
> | :--- | :--- | :--- | :--- |
> | `README.md` | Mar 12 | Yes (3 files) | Stale |
> | `ARCH.md` | Mar 14 | No | Current |
>
> **Coverage Gaps**:
> | Component | Type | Missing Documentation |
> | :--- | :--- | :--- |
> | `sightline_tool` | MCP | No input schema docs |
> | `premium_revenue` | DAX | No catalog entry |
>
> **Priority Queue**:
> 1. `README.md` — stale, blocking auditor gate on Task 2.3
> 2. `sightline_tool` MCP schema docs — Tier 3 gap
> 3. `premium_revenue` DAX catalog — Tier 3 gap
>
> **Recommended Action**: Auto-updating README.md now. MCP and DAX docs require `/docs --reference`.

> **User**: /docs --user
>
> **Scribe**:
> Generated Quick Start guide for stadium operations team.
> - First Success path: Open Rhino → Load template → Run sightline tool → Export results.
> - Limitations section included.
> - Saved to `docs/quick-start-stadium-ops.md`.