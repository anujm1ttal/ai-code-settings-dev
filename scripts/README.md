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
  "model": "claude-opus-4-8",
  "cost_per_100k_tokens": "$1.50"
}
```

Typical session: $1.07 (vs. $3.00 all-Opus).

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
