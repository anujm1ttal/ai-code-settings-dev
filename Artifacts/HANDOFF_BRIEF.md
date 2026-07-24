# Handoff Brief — MTU: Tier 1 → Claude Opus 5 (2026-07-25)

**Tier:** L1 Checkpoint (`--lite`) · **Branch:** `main` (**dirty — 14 files uncommitted**) · **Outcome:** model swap done, tested, deployed; not yet committed.

---

## Session Summary

Single user-directed task: *"change opus 4.8 to opus 5 in all of my setup."* Ran as a micro-task
(MTP) — mechanical, same-tier ID rename with no architectural change. No subagents dispatched;
orchestrator executed and verified directly.

**Skill loaded:** `claude-api` (per its own trigger rule — the prompt named a Claude model), which
supplied the authoritative model ID and the pricing/capability facts below.

---

## Completed

| Item | Outcome |
|:---|:---|
| **Model-ID swap** | `claude-opus-4-8` → `claude-opus-5` in 14 files: `rules/common/model-routing.md` (Tier 1 row), `agents/{strategist,council}.md`, `commands/{afk,blueprint,council,grill,ideate,skill-graph,sweep}.md`, `scripts/model_router.py` (×5), `scripts/README.md` (×2), `tests/test_model_router.py`, `tests/test_routing_audit_parsing.py` (×5). |
| **Verification** | `python -m pytest tests/ -q` → **136 passed**, exit 0. Post-edit grep: zero `claude-opus-4-8` outside `Artifacts/`. |
| **Deploy** | `bash scripts/deploy.sh --skip-tests` → validation passed (7 enforced hooks wired). Deployed `~/.claude/{agents,commands,rules}` re-grepped → all carry `claude-opus-5`. Backup: `~/.claude.backup-20260725-002827`. |
| **DECISION_LOG rotation** | Log hit the >400-line threshold on append; 3 oldest RESOLVED entries (2026-07-06, Phase OSA/OSA-2) moved → `Artifacts/History/DECISION_LOG-archive.md` (first entries in that archive). |

---

## Key Facts Established (don't re-derive)

- **Opus 5 is a same-tier, same-price swap.** `claude-opus-5` is $5/$25 per MTok — identical to
  Opus 4.8. `MODEL_PRICING["claude-opus-5"] = 15.0` (the file's input/output average) is therefore
  still correct, and no minimum-capable-model rule text in `model-routing.md` needed rewriting.
- **Tier-inference code is version-agnostic.** `model_router._tier_for_model()` and
  `model_routing_audit.model_family()` both match on the `"opus"` substring, so no regex or
  parser needed updating for the un-suffixed `claude-opus-5` ID.
- **Statusline needs no edit.** `~/.claude/statusline.sh` and `subagent_statusline.sh` colour by
  substring (`opus` → green), so Opus 5 renders correctly as-is.
- **`Artifacts/` had no literal `claude-opus-4-8`** — only "Opus" tier prose, which stays valid.
  Nothing historical was rewritten.

---

## Blockers / Open

- **Uncommitted work**: 14 modified files on `main`. Per `orchestration.md` §Git Phase Branching,
  implementation shouldn't sit on `main` — branch + commit, or commit directly if treating this as
  an accepted MTP. **Needs a user decision; deliberately not committed this session** (commits are
  a stop-and-surface / irreversible action).
- **Cosmetic, flagged not fixed**: `.claude/settings.local.json:74` holds a stale permission
  allowlist entry containing the string `"Opus 4.8"` (an old statusline echo-test command). Inert —
  prune only if you want the tidiness.

---

## Carried Forward (unchanged from 2026-07-24)

- **User action**: `/plugin` refresh the geometry plugin to activate the RDT Lane A-live guard —
  plugin files are **not** carried by `deploy.sh`, so RDT-1 is still not live in sessions.
- **Deferred → BACKLOG** `rdt_graduate-source-vs-deployed_1`: harden `/graduate` to resolve
  destinations against repo source, not `~/.claude/`.
- **Queued**: OXL-3 (interview mode) resumes as the active initiative.

---

## State File Health

| File | Status |
|:---|:---|
| `Artifacts/.agent/current_task.md` | ✅ Updated — MTU latest, dirty-tree warning, RDT demoted to *Previous* |
| `Artifacts/TODO.md` | ✅ Unchanged (130 lines) — MTU was an MTP, no task markers to move; no `[x]` written (concierge boundary) |
| `Artifacts/IMPLEMENTATION_PLAN.md` | ✅ Stable — untouched |
| `Artifacts/ARCH.md` | ✅ Stable — untouched |
| `Artifacts/DECISION_LOG.md` | ✅ MTU entry prepended; rotated back under threshold (<400 lines / <40 entries) |

**Hygiene:** `Artifacts/Temp/` already empty (L1 flags rather than purges). No stray `*.tmp` /
`debug.log` / uncommitted scratch files found — the 14 dirty files are all intended source edits.

---

## Gate Telemetry

| Hook | Deny | Nag | Last Fired |
|:---|---:|---:|:---|
| evidence-gate | 0 | 255 | 2026-07-24T23:27:56.660Z |
| guard-commands | 205 | 0 | 2026-07-24T23:28:17.647Z |
| guard-paths | 255 | 0 | 2026-07-24T23:28:17.290Z |
| nudge-handoff | 0 | 8 | 2026-07-24T23:28:45.805Z |
| unknown | 0 | 0 | 2026-07-08T11:46:59.712Z |

**460 deny, 263 nag across 5 hook(s).**

---

## Next Session

1. **user / coder** — decide commit strategy for the 14 dirty files (branch vs. direct-to-`main`
   as an accepted MTP), then commit + push. Suggested message: `chore(routing): bump Tier 1 model
   to claude-opus-5`.
2. **user** — `/plugin` refresh geometry (still outstanding from RDT-1).
3. **strategist** — resume OXL-3 (interview mode).
