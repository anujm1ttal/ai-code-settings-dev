# Utility Scripts

Utility scripts used by commands and agents.

## `model_router.py`

Determines the optimal Claude model for agents and skills based on task type and reasoning complexity.

**Usage**:
```bash
# Print routing table
python scripts/model_router.py --table

# Look up agent model
python scripts/model_router.py --lookup agent strategist

# Look up skill model
python scripts/model_router.py --lookup skill typescript-mcp coder
```

**Features**:
- Agent-to-model binding (mandatory assignments)
- Skill-level model overrides
- Cost estimation per model
- Reasoning-to-model mapping

**Used by**: Agent invocation logic, skill selection, cost analysis

**Output**:
- Routing tables (markdown)
- Model assignments (JSON)
- Cost estimates per 100k tokens

### Cost Example

```json
{
  "agent": "strategist",
  "tier": "opus",
  "model": "claude-opus-5",
  "cost_per_100k_tokens": "$1.50"
}
```

Typical session: $1.07 (vs. $3.00 all-Opus).

---

## Model-Routing Reference

Supporting material for `rules/common/model-routing.md` (the canonical ~60-line rule). This
section holds the cost analysis, decision tree, and config examples that don't need to be
loaded on every session — reference on demand.

### Routing Decision Tree

```
Task received
  │
  ├─ Is this strategic/architectural? → YES → Use Opus (strategist)
  │
  ├─ Is this implementation/code/review? → YES → Use Sonnet
  │
  ├─ Is this documentation/state/routine? → YES
  │   ├─ Complex narrative/structure (manuscript, layout)? → YES → Use Sonnet
  │   └─ Otherwise → Use Haiku
  │
  └─ Ambiguous → Concierge asks clarifying question
```

### Cost Impact Analysis

**Typical Session Breakdown**

| Phase | Agent | Model | Tokens | Cost |
|:---|:---|:---|:---|:---|
| Planning | strategist | Opus | 45,000 | $0.68 |
| Implementation | coder | Sonnet | 120,000 | $0.36 |
| Documentation | scribe | Haiku | 25,000 | $0.02 |
| State management | concierge | Haiku | 10,000 | $0.01 |
| **Total** | — | — | **200,000** | **$1.07** |

vs. All-Opus: $3.00 (180% cost increase). vs. All-Haiku: ~$0.16 (quality/correctness failures).

**Savings opportunity**: Haiku-only projects (docs, small scripts) ~90% reduction vs. Opus;
balanced projects (code + docs) ~60% reduction vs. all-Opus; thinking-heavy projects
(architecture, design) — Opus justified, minimal overhead.

### Config Examples

```yaml
# Agent frontmatter (agents/*.md) — canonical source for effort/reasoning_depth
strategist:
  model: claude-opus-5
  effort: high
  reasoning_depth: deep

# Skill frontmatter override
---
name: skill-name
model: claude-sonnet-5  # override from owning agent
effort: high
---
```

```python
# Agent tool invocation
agent(
  description="Task description",
  prompt="...",
  model=agent_model,   # from model-routing.md
  effort=agent_effort  # from model-routing.md
)
```

### Cost Monitoring Template

Add to `/handoff` report:

```markdown
## Model Usage Summary

| Model | Invocations | Total Tokens | Cost |
|:---|:---|:---|:---|
| Opus | 2 | 85,000 | $1.28 |
| Sonnet | 3 | 150,000 | $0.45 |
| Haiku | 4 | 65,000 | $0.05 |
| **Total** | **9** | **300,000** | **$1.78** |

Cost efficiency: 41% vs. all-Opus baseline ($4.50).
```

### Verified Routing Compliance

> ✅ **Routing is honored (verified 2026-07-06).** An initial audit *appeared* to show
> 21/45 runs bypassing their tier, but scoping to post-config transcripts
> (`--since 2026-07-05`) yields **0 violations**. The apparent bypasses were all
> pre-config sessions (before routing existed) or deliberate alternate-model runs
> (a full Fable session, early Qwen experiments) — not runtime failures. Always
> pass `--since` when auditing so historical sessions don't cry wolf.

---

## `skill_graph_analyzer.py`

Analyzes and visualizes skill dependencies based on tags, project type associations, and cross-references.

**Usage**:
```bash
python scripts/skill_graph_analyzer.py /path/to/ai-code-settings [--export]
```

**Features**:
- Extracts tags and metadata from all skills
- Builds dependency graph based on shared tags and project associations
- Identifies universal skills (3+ project types)
- Detects singletons for archival candidates
- Calculates connection strength between skills
- Generates routing recommendations
- Exports reports to `Artifacts/Temp/`

**Used by**: `/skill-graph` command (strategist workflow)

**Output**:
- Total skill count and distribution
- Tag clusters (domain groupings)
- Project affinity analysis
- Universal vs. singleton breakdown
- Strongest skill pairs (co-activation patterns)
- ASCII visualization
- Recommendations for consolidation/bundling

### Example

```bash
# Analyze the skill graph
python scripts/skill_graph_analyzer.py .

# Export report for auditing
python scripts/skill_graph_analyzer.py . --export
```

Exit code: 0 (always succeeds; no validation errors).

---

## `model_routing_audit.py`

Verifies that spawned subagents actually **ran** on the model their agent
definition assigns. Config in `agents/*.md` can be perfectly wired while the
runtime silently ignores it (e.g. subagents inheriting the main-thread model) —
this script proves it from the session transcripts, not the config.

**Usage**:
```bash
# Audit one project's transcripts
python scripts/model_routing_audit.py ~/.claude/projects/<project-hash>/

# Audit every project (default path)
python scripts/model_routing_audit.py

# Show only the runs that violated their assignment
python scripts/model_routing_audit.py <path> --violations-only

# Only audit transcripts on/after a date (exclude pre-config / alt-model sessions)
python scripts/model_routing_audit.py --since 2026-07-05

# Audit against the deployed config instead of the repo's agents/
python scripts/model_routing_audit.py <path> --agents-dir ~/.claude/agents

# Machine-readable rows
python scripts/model_routing_audit.py <path> --json
```

**How it works**:
- **Assigned model**: parsed live from the `model:` frontmatter of `agents/*.md`
  (single source of truth — auto-tracks any config edits).
- **Actual model**: the dominant model ID in each `<session>/subagents/agent-*.jsonl`
  transcript; its `agentType` comes from the sibling `.meta.json`.
- **Comparison is by tier/family** (opus / sonnet / haiku) so dated snapshots
  like `claude-haiku-4-5-20251001` correctly match an assigned `claude-haiku-4-5`.

**Statuses**: `OK` (honored), `MISMATCH` (tier bypassed), `NO-DATA` (empty
transcript), `UNMANAGED` (built-in agent with no assignment, e.g. `Explore`).

**Output**: markdown table per subagent run + a per-agent honored/violated
summary.

**Used by**: routing self-audit; CI gate on model discipline.

Exit code: 0 if every managed subagent honored its assignment, 1 on any mismatch.

---

## `backlog_audit.py`

Reports lifecycle violations in an `Artifacts/BACKLOG.md` against
`rules/common/orchestration.md` §BACKLOG Lifecycle.

BACKLOG is **searchable memory, not a work queue** — nothing schedules off it. So this
tool checks *hygiene* (small enough to search, every entry classifiable), never "is this
item overdue". **An aged OPEN entry is not a violation** — that is the artifact working
as intended.

**Usage**:
```bash
# Audit this project's backlog (default: Artifacts/BACKLOG.md)
python scripts/backlog_audit.py

# Audit an arbitrary file
python scripts/backlog_audit.py path/to/BACKLOG.md

# Silent when clean — for /handoff wiring and CI
python scripts/backlog_audit.py --violations-only
```

**Checks**:
| # | Check | Violation when |
|:--|:---|:---|
| 1 | Size | >250 lines OR >20 entries |
| 2 | Rotation due | RESOLVED entries still present **while over threshold** |
| 3 | Unmarked | entry carries no `OPEN`/`RESOLVED` status marker |
| 4 | Phase-dump | `## N. … findings` headings — per-phase append sections instead of entries |

Check 4 targets the failure mode measured in `my_mcp_rhino`: 1228 lines across 17 such
sections, none ever triaged into the real backlog.

**Read-only by contract** — never edits, rotates, or deletes. Rotation is performed by
the concierge at `/handoff`; mutation stays human-confirmed (see `/clean`).

**Portability**: single file, stdlib only, **zero repo imports** — copyable into any
project. `deploy.sh` does not ship `scripts/`, so this is repo-local until the deploy
policy question (`lh3_telemetry-deploy_1`) is resolved.

---

## `todo_graph.py`

Validates the task-dependency grammar defined in `rules/common/orchestration.md`
§Artifacts/TODO.md Authority and consumed by `commands/afk.md` §2 Frontier Definition:

```
- [ ] [agent] Tn: Description — Success: metric — Mode: AFK — Blocked by: Tm, Tk
```

Until this tool existed the grammar was defined in one file, consumed by another, and
checked by nothing.

**Usage**:
```bash
# Validate every phase TODO (default: Artifacts/Plans/*-TODO.md)
python scripts/todo_graph.py

# Validate one file
python scripts/todo_graph.py Artifacts/Plans/IGH-3-TODO.md

# Silent when clean — for /handoff wiring and CI
python scripts/todo_graph.py --violations-only
```

**Checks**:
| # | Check | Severity | Fires when |
|:--|:---|:---|:---|
| 1 | Cycle | VIOLATION | blocker loop — deadlocks `/afk` as "frontier empty, work remains" |
| 2 | Unknown ID | VIOLATION | `Blocked by:` names a task absent from the file |
| 3 | Malformed | VIOLATION | status marker not `[ ]`/`[-]`/`[x]`, or task line with no `[agent]` |
| 4 | Empty parse | VIOLATION | non-empty TODO parsing to zero tasks — the blind-zero guard |
| 5 | Redundant edge | **ADVISORY** | blocker set is exactly `{immediately preceding task}` |

**Advisories never change the exit code.** Check 5 is defined tightly to avoid false
positives: a non-adjacent blocker or a multi-blocker fan-in is never flagged, because
those are exactly the cases where the graph diverges from list order and the clause
earns its place.

**Scope**: phase TODOs only. The top-level `Artifacts/TODO.md` uses an initiative-level
format (`- [x] **NAME — Title**`, no `[agent]` field) and is deliberately not a target.

**Read-only by contract** — never edits, marks, or rotates. Marking `[-]` and `[x]` stays
with the coder and auditor per TODO Authority. It reports; it does **not** schedule —
`commands/afk.md` computes its own frontier and is not wired to this tool.

**Portability**: single file, stdlib only, **zero repo imports**. Same repo-local
limitation as `backlog_audit.py` above — third instance of `lh3_telemetry-deploy_1`.

Exit code: 0 clean, 1 on any violation.
