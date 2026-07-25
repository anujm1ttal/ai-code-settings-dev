# Model Routing & Cost Optimization

**Principle**: Route work to the minimum capable model. Opus for thinking, Sonnet for implementation, Haiku for routine tasks.

## Model Tier Assignments

| Tier | Model | Agent | Use When |
|:---|:---|:---|:---|
| **Tier 1** | `claude-opus-5` | strategist, council | Strategic decisions, architecture, multi-phase planning, conflict resolution, stress-testing |
| **Tier 2** | `claude-sonnet-5` | coder, auditor, geometry-validator | Implementation, refactoring, bug fixes, code review, test writing, schema design, geometric auditing |
| **Tier 3** | `claude-haiku-4-5` | scribe, concierge, creative-director | Documentation, state management, mechanical tasks, routine cleanup |

## Agent-to-Model Binding (Mandatory)

| Agent | Model | Override |
|:---|:---|:---|
| strategist | Opus | Never |
| coder | Sonnet | Haiku for boilerplate scaffolding only |
| auditor | Sonnet | Haiku for routine lint passes only |
| scribe | Haiku | Sonnet for complex architecture docs (ARCH.md) |
| concierge | Haiku | Never |
| creative-director | Haiku | Sonnet for complex visual systems |
| council | Opus | Never |
| geometry-validator | Sonnet | Never (dispatched, no standalone routing) |

Per-agent `effort`/`reasoning_depth` are canonical in each `agents/*.md` frontmatter, not here.

## Skill-Level Model Overrides

Skills override their agent's default model via `model:` frontmatter when reasoning complexity demands it.

| Skill | Owned by | Override | Reason |
|:---|:---|:---|:---|
| `python-rhino-grasshopper` | coder | sonnet (maintain) | Geometric reasoning complexity |
| `typescript-mcp` | coder | sonnet (maintain) | Schema + async complexity |
| `systematic-debugging` | coder | sonnet (maintain) | Root-cause requires step-through reasoning |
| `visual-composition` | creative-director | sonnet (upgrade) | Complex layout logic |
| `manuscript-review` | scribe | sonnet (upgrade) | Narrative + structural analysis |
| `doc-updater` | scribe | haiku (maintain) | Routine doc maintenance |

## Verification Tiering (Orchestrator / Executor)

Under the **run-to-done cadence** (`orchestration.md` §Execution Cadence), the model that *verifies* a gate's evidence is routed by blast radius — not fixed to the executor's tier. Route the verifier seat, not just the executor:

| Tier | Executor | Verifier (checks the gate) | When |
|:---|:---|:---|:---|
| **High-rigor** | Sonnet (coder) | **Opus** — re-reads raw artifacts, re-runs cheap checks itself | geometry, production, regulatory, security-critical, or any git-mutating / irreversible gate (the `high-rigor-engineering` skill) |
| **Normal** | Sonnet (coder) — **produces the artifact**, returns its path | Sonnet (auditor) — **opens** that artifact; **Opus reviews at phase end** or spot-checks | routine `code` / `data` implementation |
| **Micro** | executor only | executor (exit code) | MTP (≤1 file / ≤30 lines) |

- **Verifier rule (all tiers)**: the verifier checks the **artifact** (real `git diff`, raw test output, probe sentinel) — never the executor's *summary* of it. A second model agreeing with a narrative is not verification.
- **No artifact → no PASS**: the Normal tier is not a softer version of this rule, only a cheaper *seat*. An auditor with no artifact path to open returns **INCOMPLETE**, not PASS — see `orchestration.md` §Execution Cadence. Micro tier is the sole exemption.
- **Independence**: for high-rigor gates the verifier prefers **re-running / re-reading** over reasoning-review — mechanical checks don't share the executor's reasoning blind spots.
- **Cost note**: Opus verification is deliberately scoped to the high-rigor tier. Blanket Opus-checks-every-gate would double the cost of the most frequent operation and violate the minimum-capable-model principle above — do not globalize it past the high-rigor tier.

## Hard Rules

1. Strategist always uses Opus — no exceptions.
2. Council always uses Opus — deliberation requires reasoning depth.
3. Concierge always uses Haiku — state work is mechanical.
4. Coder defaults to Sonnet — switch to Haiku only for scaffolding boilerplate.
5. Opus is the verifier of record only for the **high-rigor tier** (§Verification Tiering) — routine work verifies at Sonnet (auditor) tier, micro work at executor tier. Blanket Opus verification is forbidden.

## Fallback Chain

- Opus unavailable → Sonnet → Haiku (quality warning).
- Sonnet unavailable → Haiku (quality caution); cannot fall back further.
- Haiku unavailable → cannot proceed (essential efficiency layer).

## Verification

Config being correct does not guarantee the runtime honors it — verify from session
transcripts, not the config:

```bash
python scripts/model_routing_audit.py --violations-only
```

Cost tables, routing decision tree, YAML examples, and the dated verification writeup:
`scripts/README.md` §Model-Routing Reference.
