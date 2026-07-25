---
name: high-rigor-engineering
description: Use when a phase declares high-rigor mode — geometry validation, production deploys, regulatory work, or anything requiring an auditable evidence trail and zero tolerance for rework. Do NOT use for exploratory prototyping or documentation.
model: claude-sonnet-5
metadata:
  version: "1.0.0"
  tags: [high-rigor, evidence, gate-cadence, patch-protocol, geometry, production]
---

# Skill: High-Rigor Engineering Workflow

**Owners**: coder (execution), auditor (gate verification), strategist (declares high-rigor mode at phase start).

> **Precedence**: In high-rigor mode this protocol overrides `orchestration.md` where they
> conflict (commit cadence, approval phrases); everything not addressed here follows
> `orchestration.md`.

**When to use**: Geometry-heavy work, production deployments, security-critical phases, regulatory compliance, anything requiring an auditable evidence trail and zero tolerance for rework.

This discipline enforces **synchronous gate-passing**, **runtime verification**, and **explicit approval at every decision point** to prevent hallucination, scope creep, and unverified claims.

---

## Core Principles

1. **Evidence over assertion** — Behavioral claims must be backed by runtime output, not code inspection
2. **Human in loop** — Every gate requires explicit approval; never infer permission from silence
3. **Scope lockdown** — Work within an approved file list; violations halt work immediately
4. **Verification-as-artifact** — All evidence lives in `Artifacts/Temp/` as traceable files; anything a durable record cites is promoted to `Artifacts/Evidence/<phase>/` before cleanup (`orchestration.md` §Evidence Retention)
5. **One step per response** — No bundling, no proceeding without approval

---

## 1. Evidence Protocol

All command output that supports a claim is redirected to `Artifacts/Temp/` with strict naming:

```bash
<command> > Artifacts/Temp/<phase>_<step>_<command>.txt 2>&1
```

### File Naming Convention

`<phase>_<step>_<command>.txt`
- **phase**: Current phase identifier (e.g., `phase-5`, `geometry-validation`)
- **step**: Step number within phase (e.g., `1`, `2`, `3`)
- **command**: Short command name, lowercase, underscores (e.g., `pytest`, `git_diff`, `grep_refs`)
- **Suffix**: Use numeric suffix (`_1`, `_2`) for repeated runs of the same command

**Examples:**
```
phase-5_1_pytest.txt          # First pytest run in phase 5, step 1
phase-5_2_git_diff.txt        # Git diff in phase 5, step 2
phase-5_2_grep_intersection_1.txt  # First grep for "intersection" in phase 5, step 2
```

### Commands Requiring Evidence Redirection

Mandatory for: `git diff|status|log|show`, `pytest`, probe/validation scripts, `grep`, `sed`, `cat`, `head`, `tail`, `ls`, `wc`, `find`, and any command whose output the reviewer must inspect.

**Exception**: Binary output (images, compiled files) or read-only filesystem constraints require explicit surface of constraint; do not fall back to pasting summaries into chat.

### Response Format at Every Gate

```
## [Step name]

Commands run:
<code fence with exact commands, no paraphrasing>

## Files written this step

- Artifacts/Temp/<phase>_<step>_<command>.txt
- ...

[STOP — no pasted contents, no summary, no analysis]
```

**Behavioral rule**: Do not paste file contents into chat. Do not summarize output. Do not claim "all tests passed" without evidence file. The reviewer reads evidence locally; the agent's job is to cite it.

---

## 2. Gate Cadence

Each phase plan step = exactly one response cycle.

### Rules

1. **One step per response** — Do not advance multiple steps in a single message
2. **Stop after every paste** — No appended analysis, summaries, recommendations, or "ready to proceed" framing
3. **Approval is explicit** — Never inferred from absence of objection or permissive phrasing
4. **Commit authorization is the exact phrase `approved, proceed with commit`** — No paraphrase, abbreviation, or implicit approval

### Anti-Pattern: Ship-and-Defer

Claiming completion before the reviewer approves gate evidence. Halt and surface if detected.

---

## 3. Scope Discipline

Each phase has an **explicit approved file list**. The agent does not touch files outside it.

### Halt-Immediately Triggers

- Editing or staging any file outside the approved list
- Unrequested cleanup ("while I'm in there", "improve adjacent code")
- Modifying anything in `Artifacts/Temp/` (reviewer namespace)
- Any state-mutating git command without prior approval (`add`, `commit`, `push`, `stash`, `reset`, `restore`, `checkout` on tracked files, `clean`)
- Using destructive operations (execute scripts, alter geometry, drop data) without approval

### Out-of-Scope Issues

Bugs or findings discovered outside the approved scope become **findings** (filed in `Artifacts/BACKLOG.md` under a `<phase>_<component>_<n>` id, not scattered across phase reports) and are deferred to a separate phase. They are **never fixed** in the current phase.

### Anti-Pattern: Scope-Creep-via-Cleanup

Editing out-of-scope files on adjacency or "improvement" grounds. Halt and surface if detected.

---

## 4. Patch Protocol

Fixed sequence for all code changes (non-reorderable):

### Step 1: Audit

Save current state of target file(s) and context searches:

```bash
cp <file> Artifacts/Temp/<phase>_<step>_<file>_before.txt
grep -n '<pattern>' <file> > Artifacts/Temp/<phase>_<step>_grep_<pattern>.txt
```

List the files. Stop.

### Step 2: Propose

Present the exact patch as a **real `git diff`** in chat (inline, code fence).

If diff is >~50 lines, also save to file:

```bash
git diff <file> > Artifacts/Temp/<phase>_<step>_proposed.diff.txt
```

List the file. Stop.

**Critical rule**: Diffs must be real `git diff` output (real index hashes, real headers, hunks). Hand-constructed diff-shaped text is never acceptable.

### Step 3: Approve

Wait for explicit approval. If changes requested, return to Step 2 and re-present revised diff.

### Step 4: Apply

Apply the edit via Edit tool. Immediately save applied diff:

```bash
git diff <file> > Artifacts/Temp/<phase>_<step>_applied.diff.txt
```

Verify applied diff matches approved proposal exactly. List the file. Stop.

### Step 5: Verify

Run canonical suite (lint, type-check, tests) + phase-specific probes. Redirect all output to Artifacts/Temp/:

```bash
pytest <path> > Artifacts/Temp/<phase>_<step>_pytest.txt 2>&1
ruff check <file> > Artifacts/Temp/<phase>_<step>_ruff.txt 2>&1
```

List the files. Stop.

### Anti-Patterns in Patch Protocol

- **Synthetic-diff** — Diff-shaped block not produced by real `git diff`
- **Inspection-as-verification** — Asserting behavior from reading code, not running it
- **Summary-substitution** — Replacing verbatim stdout with a summary or table

---

## 5. Named Anti-Patterns Taxonomy

On sight of any pattern below, halt and surface by name.

| Name | Definition |
|:---|:---|
| **Ship-and-defer** | Claiming completion before reviewer approval of gate evidence |
| **Summary-substitution** | Replacing verbatim stdout with a summary, table, or paraphrase instead of citing evidence file |
| **Synthetic-diff** | Diff-shaped block not produced by real `git diff`; hand-constructed or hypothetical |
| **Context-fabrication** | Reconstructing prior context from scroll history or guesswork instead of current state |
| **Inspection-as-verification** | Asserting behavior from reading code, not from runtime evidence |
| **Quiet-staging** | Running `git add`, `git commit`, or similar state-mutating git command outside an approved gate |
| **Reframing-as-test** | Treating a correction request as hypothetical ("if we did X") instead of actually fixing it |
| **Self-summary-overrides-evidence** | Agent defending its own summary against pasted evidence from Artifacts/Temp/ |
| **Scope-creep-via-cleanup** | Editing out-of-scope files on adjacency or improvement grounds ("while I'm in there") |

---

## 6. Commit Conventions

### Scope

One commit per phase, containing:
- Implementation changes
- Phase plan (`Artifacts/Plans/<phase>.md`)
- Phase report (`Artifacts/Reports/<phase>.md`)
- Promoted evidence (`Artifacts/Evidence/<phase>/`) — the files the phase report cites

Working evidence (`Artifacts/Temp/` contents) is scratch and is **not part of the commit**.

### Pre-Commit Cleanup

**Promote first, then delete.** Any Temp file the phase report (or `AUDIT_REPORT.md` /
`DECISION_LOG.md` / a `BACKLOG.md` finding) cites is promoted and repointed before the `rm` —
`orchestration.md` §Evidence Retention. Deleting a cited file is a **hard-reset trigger** (§7:
evidence contradicting reported state), not a cleanup detail.

```bash
mkdir -p Artifacts/Evidence/<phase>
mv Artifacts/Temp/<cited-file> Artifacts/Evidence/<phase>/     # per cited file, then repoint
rm Artifacts/Temp/<phase>_*.txt Artifacts/Temp/<phase>_*.diff.txt
git status > Artifacts/Temp/<phase>_cleanup_git_status.txt
```

`Artifacts/Evidence/` is **never** an `rm` target. List the cleanup status file. Stop.

Prior-phase Temp files are out of scope for the current commit.

### Format

Match prior accepted phase commits. Default: plain `-m` flags (one for title, one per body paragraph). No new conventions without explicit per-phase authorization. **Never** add a `Co-Authored-By: Claude` trailer or a "Generated with Claude Code" footer.

### Approval

Do not run `git commit` until the exact phrase `approved, proceed with commit` is received.

After commit:

```bash
git log -1 --stat > Artifacts/Temp/<phase>_commit_log.txt
```

List the file. Stop.

---

## 7. Hard-Reset Triggers

Clear conditions for abandoning current-phase working-tree changes and restarting from the prior accepted commit.

| Trigger | Action |
|:---|:---|
| Three+ recurrences of the same anti-pattern in one phase | Discard current phase, restart with fresh execution plan |
| Verbatim evidence contradicts agent-reported state on a material point | Discard current phase; audit prior commits for state drift |
| Unauthorized commit, push, or destructive `git` operation occurred | Discard current phase; restore from backup |
| Code change applied without prior proposal+approval and cannot be cleanly audited | Discard current phase; return to prior commit |
| Reviewer determines fresh start is faster than continued correction | Discard current phase; human authority, no pushback |

**Carry forward**: Phase plan and substantive diagnosis carry forward; execution evidence is discarded and re-gathered.

---

## 8. Reviewer Disagreement Protocol

If the agent believes a reviewer instruction is mistaken **based on evidence, not opinion**:

1. Surface the concern with evidence in chat
2. Wait for reviewer response
3. Do **not** silently comply
4. Do **not** proceed on agent authority

**This does not apply to rules in this file** — those are non-negotiable from the agent's side.

---

## 9. When NOT to Use This Workflow

This discipline adds overhead (synchronous gates, explicit approvals, evidence trails). Use it when:

✅ **Geometry validation, manifold verification, tolerance alignment** (geometry projects)  
✅ **Production deployments, security-critical changes** (high-stakes infrastructure)  
✅ **Regulatory compliance, audit requirements** (PII, HIPAA, SOC2)  
✅ **Multi-million-dollar models, high-precision calculations** (financial, scientific)  
✅ **Anything with zero-rework tolerance** (deployed Rhino scripts, vendor deliverables)

❌ **Exploratory prototyping** → Use standard orchestration.md  
❌ **Documentation updates, README changes** → Use standard workflow  
❌ **Low-stakes bug fixes in development code** → Use standard workflow  

---

## 10. Integration with Standard Orchestration

This workflow is **a variant of** `orchestration.md`, not a replacement:

- All standard agents (strategist, coder, auditor, scribe, concierge) are still active
- All standard commands (`/blueprint`, `/audit`, `/handoff`) still apply
- **Difference**: Implementation and verification are synchronous with explicit gates instead of async

For projects using high-rigor discipline:
1. Phase plan declares "high-rigor" mode in first task description
2. Agent adheres to evidence protocol + gate cadence + patch protocol for all implementation steps
3. Auditor verifies hard rules (anti-patterns, scope violations, evidence completeness) during review
4. Commit gates remain explicit

---

## 11. Example: High-Rigor Phase

```
Phase 5: Geometry Manifold Validation (HIGH-RIGOR)

Objective: Validate closure and manifoldness of all Brep objects in gBlox model.

Approved files:
  - src/geometry/validator.py
  - tests/geometry/test_validator.py
  - Artifacts/Plans/phase-5.md
  - Artifacts/Reports/phase-5.md

Step 1 [strategist]:
  - Read prior phase report
  - Interview user: "Which Breps are scope?"
  - Propose file list + success metric
  - Wait for approval

Step 2 [coder]:
  - Audit: cp validator.py before.txt, grep "is_manifold" ...
  - List files. Stop.
  - [Wait for review]
  - Propose: git diff showing new manifold_validator() function
  - List proposed.diff.txt. Stop.
  - [Wait for approval]
  - Apply edit. Save git diff applied.diff.txt. Stop.
  - Verify: pytest tests/geometry/test_validator.py → pytest.txt
  - List pytest.txt. Stop.

Step 3 [auditor]:
  - Read phase-5_2_proposed.diff.txt
  - Inspect Artifacts/Temp/ evidence files locally
  - Approve or request changes
  - If approved: "approved, proceed with commit"

Step 4 [coder]:
  - rm Artifacts/Temp/phase-5_*.txt
  - git commit ... phase-5
  - git log -1 --stat → commit_log.txt
  - List file. Stop.

Step 5 [auditor]:
  - Mark Artifacts/TODO.md [x]
  - Confirm metrics met
  - Archive phase to history if next phase ready
```

---

## References

- `rules/common/orchestration.md` — Standard workflow (for comparison)
- `rules/common/testing-strategy.md` — Evidence rules for test lanes
- `rules/common/coding-style.md` — Code quality gates
- Project-specific CLAUDE.md files for domain adaptations
