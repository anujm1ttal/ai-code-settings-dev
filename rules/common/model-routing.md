# Model Routing & Cost Optimization

**Principle**: Route work to the minimum capable model. Opus for thinking, Sonnet for implementation, Haiku for routine tasks.

## Model Tier Assignments

| Tier | Model | Agent | Cost | Use When |
|:---|:---|:---|:---|:---|
| **Tier 1** | `claude-opus-4-8` | strategist, council | ~$15/1M | Strategic decisions, architecture, multi-phase planning, conflict resolution, stress-testing |
| **Tier 2** | `claude-sonnet-5` | coder, auditor | ~$3/1M | Implementation, refactoring, bug fixes, code review, test writing, schema design |
| **Tier 3** | `claude-haiku-4-5` | scribe, concierge, creative-director | ~$0.8/1M | Documentation, state management, mechanical tasks, routine cleanup |

## Agent-to-Model Binding

### Core Agents (Mandatory)

```yaml
strategist:
  model: claude-opus-4-8
  effort: high
  reasoning_depth: deep
  use_for:
    - /blueprint (Step 0, architecture)
    - /grill (stress-testing plans)
    - /skill-graph (dependency analysis)
    - /council (deliberation)
  when_to_override: Never (opus is mandatory)

coder:
  model: claude-sonnet-5
  effort: high
  reasoning_depth: moderate
  use_for:
    - Implementation dispatch
    - Refactoring, bug fixes
    - Test writing
    - Schema/API design
  when_to_override: Use haiku for boilerplate scaffolding only

auditor:
  model: claude-sonnet-5
  effort: high
  reasoning_depth: moderate
  use_for:
    - /audit gates
    - Compliance review
    - Logic/style verification
  when_to_override: Use haiku for routine lint passes only

scribe:
  model: claude-haiku-4-5
  effort: low
  reasoning_depth: shallow
  use_for:
    - /docs (README, API docs)
    - /explain (code walkthroughs)
    - Documentation maintenance
  when_to_override: Use sonnet for complex architecture docs (ARCH.md)

concierge:
  model: claude-haiku-4-5
  effort: low
  reasoning_depth: shallow
  use_for:
    - /sync (drift detection)
    - /clean (housekeeping)
    - /handoff (compression)
  when_to_override: Never (routine state work)

creative-director:
  model: claude-haiku-4-5
  effort: low
  reasoning_depth: shallow
  use_for:
    - /deck (PowerPoint scaffolding)
    - Layout composition
  when_to_override: Use sonnet for complex visual systems

council:
  model: claude-opus-4-8
  effort: xhigh
  reasoning_depth: deep
  use_for:
    - /council (multi-persona deliberation)
    - Architectural conflict resolution
  when_to_override: Never (deliberation requires opus)
```

---

## Skill-Level Model Overrides

Skills can override their agent's default model when reasoning complexity demands it:

```yaml
# In skill SKILL.md frontmatter
model: claude-sonnet-5  # override from agent's default

# Example: business-analyst requires complex ROI reasoning
# Even though owned by strategist (opus), use sonnet for efficiency
```

### Skills with Required Overrides

| Skill | Owned by | Override | Reason |
|:---|:---|:---|:---|
| `python-rhino-grasshopper` | coder | `sonnet` (maintain) | Geometric reasoning complexity |
| `typescript-mcp` | coder | `sonnet` (maintain) | Schema + async complexity |
| `systematic-debugging` | coder | `sonnet` (maintain) | Root-cause requires step-through reasoning |
| `visual-composition` | creative-director | `sonnet` (upgrade) | Complex layout logic |
| `manuscript-review` | scribe | `sonnet` (upgrade) | Narrative + structural analysis |
| `doc-updater` | scribe | `haiku` (maintain) | Routine doc maintenance |

---

## Routing Decision Tree

```
Task received
  │
  ├─ Is this strategic/architectural? → YES → Use Opus (strategist)
  │
  ├─ Is this implementation/code/review? → YES
  │   ├─ Complex reasoning (geometry, async, schema)? → YES → Use Sonnet
  │   └─ Otherwise → Use Sonnet
  │
  ├─ Is this documentation/state/routine? → YES
  │   ├─ Complex narrative/structure (manuscript, layout)? → YES → Use Sonnet
  │   └─ Otherwise → Use Haiku
  │
  └─ Ambiguous → Concierge asks clarifying question
```

---

## Cost Impact Analysis

### Typical Session Breakdown

| Phase | Agent | Model | Tokens | Cost |
|:---|:---|:---|:---|:---|
| Planning | strategist | Opus | 45,000 | $0.68 |
| Implementation | coder | Sonnet | 120,000 | $0.36 |
| Documentation | scribe | Haiku | 25,000 | $0.02 |
| State management | concierge | Haiku | 10,000 | $0.01 |
| **Total** | — | — | **200,000** | **$1.07** |

**vs. All-Opus**: $3.00 (180% cost increase)
**vs. All-Haiku**: ~$0.16 (quality/correctness failures)

### Savings Opportunity

- **Haiku-only projects** (docs, small scripts): 90% cost reduction vs. Opus
- **Balanced projects** (code + docs): 60% cost reduction vs. all-Opus
- **Thinking-heavy projects** (architecture, design): Opus justified (minimal overhead)

---

## Enforcement & Fallback

### Hard Rules

1. **Strategist always uses Opus** — no exceptions
2. **Council always uses Opus** — deliberation requires reasoning depth
3. **Concierge always uses Haiku** — state work is mechanical
4. **Coder defaults to Sonnet** — switch to Haiku only for scaffolding boilerplate

### Fallback Chain

If a model is unavailable:
```
Tier 1 request (Opus unavailable)
  → Fall back to Sonnet
  → Fall back to Haiku (quality warning)

Tier 2 request (Sonnet unavailable)
  → Fall back to Haiku (with quality caution)
  → Cannot fall back further (must wait)

Tier 3 request (Haiku unavailable)
  → Cannot proceed (essential efficiency layer)
```

### Verification (are these assignments actually honored?)

Config being correct does **not** guarantee the runtime honors it. Verify from
session transcripts, not the config:

```bash
python scripts/model_routing_audit.py                    # audit all projects
python scripts/model_routing_audit.py --violations-only  # only the bypasses
```

It compares each spawned subagent's *actual* model (from its transcript) against
the `model:` frontmatter in `agents/*.md`, by tier family. Exit 1 on any mismatch
(CI-usable). Use `--since YYYY-MM-DD` to scope the audit to transcripts after your
routing config took effect — otherwise pre-config and deliberate alternate-model
sessions register as false positives. See `scripts/README.md` for full options.

> ✅ **Routing is honored (verified 2026-07-06).** An initial audit *appeared* to
> show 21/45 runs bypassing their tier, but scoping to post-config transcripts
> (`--since 2026-07-05`) yields **0 violations**. The apparent bypasses were all
> pre-config sessions (before routing existed) or deliberate alternate-model runs
> (a full Fable session, early Qwen experiments) — not runtime failures. Always
> pass `--since` when auditing so historical sessions don't cry wolf.

---

## Implementation Details

### In Agent Invocations

```python
# When calling Agent tool:
agent(
  description="Task description",
  prompt="...",
  model=agent_model,  # from model-routing table
  effort=agent_effort  # from model-routing table
)
```

### In Skill Metadata

```yaml
---
name: skill-name
model: claude-sonnet-5  # override from owning agent
effort: high
---
```

### In Orchestration.md

```markdown
When routing to agent, consult model-routing.md:
- Strategist → Opus (mandatory)
- Coder → Sonnet (default)
- Auditor → Sonnet (default)
- Scribe → Haiku (default, sonnet for complex docs)
- Concierge → Haiku (mandatory)
```

---

## Cost Monitoring

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

This data informs next-session routing decisions.
