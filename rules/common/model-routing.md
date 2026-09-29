# Model Routing & Cost Optimization

**Principle**: Route work to the minimum capable model. Opus for thinking, Sonnet for implementation, Haiku for routine tasks.

## Model Tier Assignments

| Tier | Model | Agent | Use When |
|:---|:---|:---|:---|
| **Tier 1** | `claude-opus-5-5` | strategist, council | Strategic decisions, architecture, multi-phase planning, conflict resolution, stress-testing |
| **Tier 2** | `claude-sonnet-5-5` | coder, auditor, geometry-validator | Implementation, refactoring, bug fixes, code review, test writing, schema design, geometric auditing |
| **Tier 3** | `claude-haiku-4-5` | scribe, concierge, creative-director | Documentation, state management, mechanical tasks, routine cleanup |

## Agent-to-Model Binding (Mandatory)

Canonical: `agents/*.md` frontmatter `model:`/`effort`/`reasoning_depth` (+ `agents/agents.overview.md`).

## Skill-Level Model Overrides

Table: `skills/skills.overview.md` §Skill-Level Model Overrides.

## Verification Tiering (Orchestrator / Executor)

Under the **run-to-done cadence** (`orchestration.md` §Execution Cadence), the model that *verifies* a gate's evidence is routed by blast radius — not fixed to the executor's tier. Route the verifier seat, not just the executor:

| Tier | Executor | Verifier (checks the gate) | When |
|:---|:---|:---|:---|
| **High-rigor** | Sonnet (coder) | **Opus** — re-reads raw artifacts, re-runs cheap checks itself | geometry, production, regulatory, security-critical, or any git-mutating / irreversible gate (the `high-rigor-engineering` skill) |
| **Normal** | Sonnet (coder) — **produces the artifact**, returns its path | Sonnet (auditor) — **opens** that artifact; **Opus reviews at phase end** or spot-checks | routine `code` / `data` implementation |
| **Micro** | executor only | executor (exit code) | MTP (≤1 file / ≤30 lines) |

- **Verifier rule (all tiers)**: checks the **artifact** (diff, raw test output, probe sentinel),
  never the executor's summary. No artifact path, or an unopened one, means INCOMPLETE not PASS
  (`orchestration.md` §Execution Cadence) — Micro tier is the sole exemption.
- **Cost note**: Opus verification is scoped to high-rigor only — blanket Opus-checks-every-gate
  doubles the cost of the most frequent operation and violates minimum-capable-model.

## Hard Rules

1. Strategist always uses Opus — no exceptions.
2. Council always uses Opus — deliberation requires reasoning depth.
3. Concierge always uses Haiku — state work is mechanical.
4. Coder defaults to Sonnet — switch to Haiku only for scaffolding boilerplate.
5. Opus is the verifier of record only for the **high-rigor tier** (§Verification Tiering) — routine work verifies at Sonnet (auditor) tier, micro work at executor tier. Blanket Opus verification is forbidden.

## Fallback Chain & Verification

Harness `fallbackModel` chain + verification: `scripts/README.md` §Model-Routing Reference.
