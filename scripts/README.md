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

## `manifest_validator.py`

Validates and analyzes `project.json` manifests.

**Usage**:
```bash
python scripts/manifest_validator.py /path/to/project [--export]
```

**Features**:
- Schema validation against `templates/project.schema.json`
- Cross-references declared skills with actual registry
- Detects redundant declarations
- Calculates token savings
- Generates optimization recommendations
- Exports reports to `Artifacts/Temp/`

**Used by**: `/manifest` command (concierge workflow)

**Output**:
- Validation status (errors/warnings)
- Effective skill list
- Token analysis
- Recommendations for optimization

### Example

```bash
# Validate and analyze manifest
python scripts/manifest_validator.py .

# Export report for auditing
python scripts/manifest_validator.py . --export
```

Exit code: 0 if valid, 1 if invalid.
