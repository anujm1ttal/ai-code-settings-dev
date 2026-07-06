# Phase OSA — OS Self-Audit

**Type:** `os-maintenance` · **Owner:** strategist → coder → auditor · **Branch:** `phase-os-audit`
**Status:** DRAFT — awaiting Step 0 approval
**Created:** 2026-07-06 (absorbs uncommitted drift surfaced by /sync)

> Absorbs two OS-improvement workstreams that were sitting uncommitted on `main`
> with no plan home. Structured pilot-first so the short part lands fast and the
> larger plugin rollout is gated on proof.

---

## 1. Purpose

Two independent self-audit findings need a home:

- **A — Model-routing is silently bypassed.** A tool built this session
  (`scripts/model_routing_audit.py`) proves from transcripts that `coder`,
  `auditor`, and `strategist` subagents frequently ran on `claude-haiku-4-5`
  despite config assigning Sonnet/Opus. Config is honored in theory, ignored at
  runtime.
- **B — The plugin registry surfaces no skills.** `optional_plugins/*/plugin.yaml`
  + `project.json → plugins[]` is a bespoke abstraction with **no loader**. Only
  `~/.claude/skills/` surfaces skills. The `auto_include=false` "saves ~2,400
  tokens" claim in `CLAUDE.md` is true by accident, not by design.

**Decision (2026-07-06):** resolve B by converting `optional_plugins/*` into real
Claude Code plugins (`.claude-plugin/marketplace.json` + `plugin.json`), unifying
the two registries so `enabledPlugins` becomes a real toggle.

## 2. Step 0 — Minimalism

- **A is already built** (drift). Remaining work = verify + commit, not build.
- **B is pilot-first.** Convert ONE group (`code-mcp`) and prove the native scan
  surfaces a skill *before* touching the other 6. No big-bang rewrite.
- The model-routing MISMATCH itself is **detect-only** here — the runtime bypass
  is likely unfixable from config and gets a separate Step 0 if pursued.

## 3. Workstream A — Model-Routing Verification (absorb + commit)

Files (all already modified on `main`, to move onto branch):
- `scripts/model_routing_audit.py` (new, 212 L, compiles ✅, runs → exit 1)
- `scripts/README.md` (+audit tool docs)
- `Artifacts/LOCAL_AGENT_PROFILES.json` (+`creative-director` profile — config hygiene)

Evidence captured this session: fresh run vs `agents/` produced a MISMATCH table
(coder/auditor/strategist on haiku) with exit 1 — tool proven functional.

Remaining tasks:
- **A1 [auditor]** Verify tool: run `python scripts/model_routing_audit.py --agents-dir agents`; confirm markdown table + `--violations-only` + exit-code semantics. — *Success: table renders; exit 1 on mismatch, 0 when `--violations-only` empty.*
- **A2 [coder]** Commit workstream A standalone on `phase-os-audit`. — *Success: 3 files committed; `py_compile` clean; commit isolated from B.*

Finding (deferred → `BACKLOG.md`, NOT fixed here): subagents run on wrong tier;
root cause = runtime ignoring `model:` frontmatter. Needs its own Step 0.

## 4. Workstream B — Plugin Registry Unification (real impl)

7 groups exist: `code-mcp, geometry, manuscript, ms-office, pbi-report, visual-storytelling, youtube`. Each has one `plugin.yaml` + N skill dirs. No `.claude-plugin/` marker yet.

- **B0 [strategist] `[user-approval]`** Step-0 sub-gate: lock `plugin.yaml → plugin.json` field mapping, marketplace layout, and native skill path (`<plugin>/skills/<name>/SKILL.md`). — *Success: mapping table approved; pilot file list fixed.*
- **B1 [coder]** Pilot — convert `code-mcp` only: author root `.claude-plugin/marketplace.json` + `code-mcp/.claude-plugin/plugin.json`; restructure skills to native path (move only, no content edits). — *Success: schema-valid manifest; skills relocated byte-identical.*
- **B2 [coder+auditor]** Prove it: register marketplace + `/plugin install` + restart; confirm the Skill tool surfaces `python-mcp` or `typescript-mcp`. — *Success: a converted skill appears in the live Skill list (evidence: session skill listing).*
- **B3 [coder]** Roll out remaining 6 groups — **gated on B2 pass**. — *Success: all 7 groups native; `manifest_validator` reconciled or retired.*
- **B4 [scribe]** Correct the honesty gap: reword the `auto_include`/token-saving claim in `CLAUDE.md` + `orchestration.md`; reconcile the two-registry docs. — *Success: no doc claims gating the manifest doesn't do.*
- **B5 [auditor]** Verify all gates + mark phase terminal; merge `phase-os-audit` → `main`. — *Success: pilot skill surfaces; docs honest; tests green.*

## 5. Hard Rules (Auditor rejects on violation)

1. **No skill-content edits during conversion** — SKILL.md bodies move byte-for-byte; restructure only.
2. **Pilot before rollout** — B3 may not start until B2 proves a native skill surfaces live.
3. **Model-routing MISMATCH is detect-only** — no runtime "fix" attempted in this phase without a fresh Step 0.

## 6. Sequencing

```
A1 → A2 (commit)  ──┐  (independent, land first — the "short" win)
                    │
B0 [approval] → B1 → B2 [proof gate] → B3 → B4 → B5 [merge]
```

A is unblocked now. B0 needs your field-mapping approval before any B code.
