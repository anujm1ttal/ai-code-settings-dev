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

## Fallback Chain (harness-verified, 2026-09-29)

**This repo's own routing code still implements no fallback.** `grep -n "fallback\|unavailable"
scripts/model_router.py` returns 0 matches — that finding stands. What changed: the underlying
Claude Code **harness** does provide a real, verified mechanism, scoped narrower than this
section previously implied. Verified directly against the installed CLI (`claude --help` +
the shipped binary's embedded Zod schema for `fallbackModel`), not asserted from memory:

- **Interactive/main session only**: `~/.claude/settings.json` → `"model"` (primary, single
  string) + `"fallbackModel"` (ordered array of strings, ≥1 model, none equal to `"model"`).
  Equivalent CLI flag: `--fallback-model <model1,model2>`. On overload/unavailability, Claude
  Code automatically retries the next model in the array; it re-tries the primary at the start
  of each new user turn. This deployment runs: primary `claude-sonnet-5-5` → fallback
  `claude-sonnet-5`.
- **Not available for subagent dispatch.** Agent frontmatter (`agents/*.md` → `model:`) is a
  **scalar field only** — no fallback array, no chain. If a subagent's declared model is
  unhosted, dispatch fails (loud), it does not silently retry a lesser model. This is the
  correct failure mode, not a gap to close: a strategist/council call silently downgraded from
  Opus to Sonnet without saying so would misrepresent the rigor of the judgment it returned.
- **API-level `fallbacks` (server-side, refusal-triggered) is a different mechanism** from the
  CLI's `fallbackModel` (client-side, overload/unavailability-triggered) — the two are not
  interchangeable and `settings.json` does not expose a passthrough to the API-level one.

## Verification

Config being correct does not guarantee the runtime honors it — verify from session
transcripts, not the config:

```bash
python scripts/model_routing_audit.py --violations-only
```

Cost tables, routing decision tree, YAML examples, and the dated verification writeup:
`scripts/README.md` §Model-Routing Reference.
