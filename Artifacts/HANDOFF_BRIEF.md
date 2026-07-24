# Handoff Brief — RDT-1 Complete + /graduate Correction (2026-07-24)

**Tier:** L2 Session · **Branch:** `main` (clean, pushed `dcd321a`) · **Outcome:** RDT-1 shipped; 8 inbox learnings graduated (after fixing a wrong-layer write).

---

## Session Summary

User asked to make correct-document targeting mandatory for `rhinocode` (Lane A-live). Ran as a
full `/blueprint` initiative (RDT): Step 0 → 3 design decisions via AskUserQuestion → coder →
audit (1 reject → fix → GO) → commit/merge/push. Then `/graduate` of 8 `my_mcp_rhino` inbox
entries, which surfaced and corrected a deployment-model violation.

**Agents active:** strategist (orchestrator/Opus), coder (RDT impl), auditor (gate + re-audit),
concierge (graduation). Orchestrator verified raw artifacts throughout.

---

## Completed

| Item | Outcome |
|:---|:---|
| **RDT-1** — Lane A-live doc guard | `resolve_instance()` fail-loud on >1 Rhino instance (filters `processName=="Rhino"`; `RHINO_INSTANCE_ID` override); doc-hint guard aborts (`SENTINEL+"94"`) on `RHINO_DOC_HINT` ⊄ `ActiveDoc.Name`. `_INSTANCE_ID_RE` removed. SKILL.md Key Rules 3–4 + pitfalls row. 136 pytest exit 0, auditor GO. Merged `2b9f88d`. |
| **Premise correction** (live probe) | No `-i` flag exists → rule is "always `-r`, never bare"; PIDs volatile (`37092` stale) → resolve by doc-hint; `compute.geometry` publishes a `remotepipe_*` pipe the old first-match regex could target. |
| **/graduate** — 8 inbox learnings | All 8 graduated to source rules/skills. Inbox clean. Commits `48842c1` (entry 7 + inbox) + `dcd321a` (entries 1–6, 8 corrected into source). |

---

## Key Correction (don't repeat)

`/graduate` initially wrote 6/8 rule edits to **deployed** `~/.claude/rules/common/*.md` instead of
**repo source** `rules/common/*.md` — unversioned, would be clobbered on next `deploy.sh`. Detected
via mtime diff (deployed 23:26–23:28 vs source 11:05–15:37, working tree clean). Ported to source,
re-deployed (exit 0), pushed. **Filed → BACKLOG `rdt_graduate-source-vs-deployed_1`.**

---

## Blockers / Open

- **User action required**: RDT guard is **not live** until you `/plugin`-refresh the geometry
  plugin — plugin files aren't carried by `deploy.sh`.
- No code blockers.

## Decisions (also in DECISION_LOG [RDT])

1. RDT-1 premise corrected via live probe (no `-i`; volatile PIDs; compute.geometry pipe) → design.
2. `/graduate` wrote to deployed dir → corrected into source + re-deployed; command-hardening deferred to BACKLOG.

---

## State File Health

- `current_task.md` — ✅ updated (RDT-1 close + graduation correction)
- `TODO.md` — ✅ RDT marked complete `[x]`; OXL restored as active initiative
- `DECISION_LOG.md` — ✅ 2 entries appended (~23 entries total, under 40 — no rotation)
- `BACKLOG.md` — ✅ finding filed
- `IMPLEMENTATION_PLAN.md` / `ARCH.md` — stable, untouched

## Gate Telemetry

| Hook | Deny | Nag | Last Fired |
|:---|---:|---:|:---|
| evidence-gate | 0 | 250 | 2026-07-24T22:33:50Z |
| guard-commands | 201 | 0 | 2026-07-24T22:34:11Z |
| guard-paths | 250 | 0 | 2026-07-24T22:34:11Z |
| nudge-handoff | 0 | 7 | 2026-07-22T12:58:08Z |

451 deny, 257 nag across 5 hooks.

---

## Next Session

- **User**: `/plugin` refresh geometry → activate RDT guard in sessions.
- **strategist**: resume **OXL-3** (interview mode) — now the active initiative; RDT was out-of-sequence.
- **Deferred**: BACKLOG `rdt_graduate-source-vs-deployed_1` (harden `/graduate` source-vs-deployed).
