---
description: Technical review for code quality, domain compliance, and plan gate validation. Invokes the auditor. Supports --pre mode for plan review before implementation.
argument-hint: "[--pre|--team] [component]"
model: claude-sonnet-5
---

# Command: /audit

**Target**: `$ARGUMENTS` → mode flag (`--pre`/`--team`) + optional `[component]` scope.

Invokes the **auditor** agent for cross-domain quality check against `coding-style.md` and domain skills.

> [!NOTE]
> The `/audit` command automatically skips virtual environments (`venv`, `.venv`, `env`) and build artifacts to ensure focus on project source code.

## Modes

### Default: Post-Implementation Review
1. **Phase 0 — Stack Detection**: Identify language, framework, build, test, and lint tools. Output a **Project Profile** (see `auditor.md`).
2. **Phase 1 — Project Mapping**: Trace entry points, map dependencies, note architecture pattern. Build context before finding issues.
3. **Constraint Review**: Evaluate against Minimalism and Risks from `Artifacts/IMPLEMENTATION_PLAN.md`.
4. **Domain Scan**: Equip skill per `orchestration.md` routing. Run checks per `coding-style.md` + relevant skill file.
5. **Gap Analysis**: Identify what is **completely missing** (not just done poorly) — missing tests, validation, error handling, docs, config, etc.
6. **Generate Report**: **CRITICAL:** Do not just output the report in the chat. You MUST save the enclosed report format into a file named `Artifacts/AUDIT_REPORT.md` in the project root. Action Items live in that report (loose findings → `Artifacts/BACKLOG.md`) and are flagged for the **strategist** to schedule — the auditor MUST NOT add tasks to `Artifacts/TODO.md` (TODO authority table, `orchestration.md`).

### `/audit --pre`: Plan Review
1. Read target task from `Artifacts/TODO.md` + parent phase in `Artifacts/IMPLEMENTATION_PLAN.md`.
2. Validate success metric is numeric and verifiable.
3. Verify dependencies satisfied — no predecessors still `[ ]` or `[-]`.
4. Flag ambiguity that could cause scope creep.
5. Output **GO** / **NO-GO** with specific concerns.

### `/audit --team`: Parallel Expert Review
Leverages Claude Agent Teams to perform a significantly faster and deeper code review. If token context limits are hit, automatically fall back to standard execution.
1. Instruct the `auditor` to spawn a parallel team:
   - **Compliance Reviewer**: Focuses only on `coding-style.md` standard compliance, PEP 8, and structure.
   - **Domain Specialist**: Executes the domain-specific scan (e.g., `python-rhino-grasshopper` or `dax-modeling`).
   - **Risk Reviewer**: Audits for security, edge cases, and math correctness.
2. The lead `auditor` waits for teammates to finish and aggregates findings into `Artifacts/AUDIT_REPORT.md` (Action Items flagged for the strategist, not written to `Artifacts/TODO.md`).

### `/audit --reader-test`: Clean-Room Verification
Protocol for validating that documentation is self-contained and ambiguity-free.
1. Read target document (Plan, Spec, or Arch doc).
2. Spawn a subagent with `subagent_type: scribe` (fresh reader, no conversation history).
3. Provide ONLY the target document as context.
4. Collect questions and ambiguities identified by the "fresh" agent.
5. Report findings as gaps in `Artifacts/AUDIT_REPORT.md`.

## Domain Scans

All scan rules are defined in `coding-style.md`. Domain-specific additions:

- **Rhino/GH**: Data tree paths, C-Value thresholds (≥60mm general, ≥90mm premium), tolerance checks, geometry disposal.
- **TypeScript/MCP**: JSON-RPC compliance, Zod schemas, HitL for destructive tools, async error boundaries.
- **Power BI/DAX**: Star Schema integrity, no Fact calculated columns, VAR/RETURN, DIVIDE safety, iterator justification.
- **C#/GH Plugins**: IDisposable, NuGet hygiene, `dotnet build` clean.
- **Manuscript**: Structural integrity, character agency, pacing. Generates `Artifacts/EDITORIAL_LETTER.md`.
- **Python (all)**: PEP 8 via `ruff`, `pyright` types, anti-pattern sweep, `frozen=True` dataclasses, Loguru enforcement.
- **PowerPoint (pptx)**: Template-first, no raw EMUs, no inline colors, layout name lookup, composition compliance → `pptx`, `visual-composition`.
- **Power BI Report (pbi-report)**: Theme JSON applied, ≤8 visuals/page, measures only, mobile layout required, no pie/3D/gauge → `powerbi-report`, `visual-composition`.

### AI Code Quality (All Languages — Slop Detection)
- **Empty catches**: `catch {}` around file ops or process management → require specific error handling
- **Redundant `return await`**: Remove when no enclosing try block
- **Generic error swallowing**: `catch (Exception)` without re-throw or specific handling
- **Placeholder comments**: "TODO", "FIXME", "HACK" without associated task in `Artifacts/TODO.md`
- **Unreachable code**: Dead branches, impossible conditions, redundant null checks

**Nuance**: Not all "sloppy" patterns are bugs. Fire-and-forget operations, shutdown cleanup, and best-effort paths may legitimately swallow errors. Flag the pattern, but assess whether it's the correct engineering choice before requiring a fix.

## Health Score

Every full audit report computes an overall project health score:

`Health = Architecture (20%) + Code Quality (15%) + Test Coverage (25%) + Documentation (15%) + Compliance (25%)`

Each dimension is scored 0–100. Bands: **90+** Good · **80–89** Acceptable · **<80** Needs Work. Record the score in `Artifacts/AUDIT_REPORT.md` so project health can be trended across audits.

## Severity Levels

- **CRITICAL**: Security flaws, math errors, crashes, data corruption, unit mismatches, schema violations, missing IDisposable.
- **HIGH**: Performance gaps, missing error handling, calculated columns in Facts, functions >50 lines, passive protagonist (manuscript).
- **MEDIUM**: Naming deviations, missing Step 0 rationale, stale documentation.

## Report Format

### Strengths (Always First)

List what's done well — reference specific files and patterns. This section is mandatory.

> ✅ [Description of strength — `path/to/file`]

### Findings

Numbered IDs for traceability. Every finding must reference real files and include before/after code.

> **[SEVERITY] [F-001] Issue Title**
> - **Issue**: What's wrong — `path/to/file:line`
> - **Risk**: Impact if unaddressed
> - **Fix**: Specific remediation
> - **Before:**
> ```lang
> current code from the actual project
> ```
> - **After:**
> ```lang
> improved code
> ```

For CRITICAL / HIGH findings, include a **Rollback** note (what to revert if the fix causes regressions).

### Gap Analysis

Things completely missing — distinct from findings (broken vs absent).

> 🕳️ **[GAP-001]** Description — affected area — ⏱️ estimate

### Action Items

Atomic, single-completable tasks. Every item gets a time estimate and severity.

> - [ ] **[TODO-001]** Atomic task — `path/to/file` — ⏱️ 30min — 🔴 Critical
>   - ↳ Depends on: TODO-002

Map all dependencies at the bottom of the report.

## Integration
- Run after coder finishes a task, or before coder begins (`--pre`).
- Auditor is sole authority for `[x]` in `Artifacts/TODO.md` (see `orchestration.md`).

## Phase Completion & Git Merge

When the `auditor` marks the final task of a phase as `[x]`:

1. **Verify Metrics**: Confirm all success metrics for the phase (defined in `IMPLEMENTATION_PLAN.md`) are verified.
2. **Merge Trigger**: Explicitly instruct the user to merge the phase branch into `main`.
   - Command: `git checkout main`, `git merge phase-[N]-[description]`.
3. **Cleanup**: Instruct the user to delete the local and remote phase branch.
   - Command: `git branch -d phase-[N]-[description]`.
4. **Handoff**: The terminal state of a phase requires a `/handoff` to summarize achievements and prepare for the next phase.

## Skill Registry Consistency

Registry integrity is owned by `/registry-audit` (invoked by `/sweep --registry`). Do not
duplicate that logic here — run `/registry-audit` when a registry consistency check is needed.