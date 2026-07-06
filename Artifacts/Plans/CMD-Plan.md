# Implementation Plan: CMD — CLAUDE.md Discipline

**Project type:** `code` (OS meta-tooling) · **Owner:** strategist · **Status:** Phase CMD-1 — branch created, awaiting rubric sign-off
**Branch:** `phase-cmd-1-claude-md-standard`

---

## 1. Purpose

Give the AI OS a canonical standard for CLAUDE.md files and cleanly separate the
**global** user instructions from **this repo's** project instructions.

Three deliverables, in strict dependency order:

1. **The Standard** — a rubric + template defining what a good CLAUDE.md is *in this OS*.
2. **The Split** — `CLAUDE-global.md` (deployable global) + a slimmed repo `CLAUDE.md`.
3. **The Command** — a thin `/claude-md` wrapper over the already-installed
   `claude-md-improver` plugin, graded against our Standard.

---

## 2. Recon Findings (current physical state)

| Fact | Evidence |
|:---|:---|
| Repo `CLAUDE.md` and `~/.claude/CLAUDE.md` are **byte-identical** | `diff` empty; both 194 lines |
| `deploy.sh` copies repo `CLAUDE.md` → `~/.claude/CLAUDE.md` **verbatim** | `scripts/deploy.sh:126` |
| One file serves two roles (global OS + this repo's project instructions) | conflation to fix |
| Audit-and-update engine **already exists** (official plugin, installed) | `~/.claude/plugins/.../claude-md-management/skills/claude-md-improver`; also `revise-claude-md` |
| The generic improver grades against **generic** templates, not our OS | the real gap = a canonical standard |
| `GEMINI.md` is **not** deployed by `deploy.sh` | `grep GEMINI scripts/deploy.sh` = 0 → out of scope |
| Commands are flat `commands/*.md` with `description` + `argument-hint` frontmatter | e.g. `commands/learn.md` |

**Step 0 (approved):** VALUE_CHECK — separate global/project CLAUDE.md and give the OS a
quality bar audited against *our* conventions. MINIMALISM — build only the missing
*standard* + thin wrapper + file split; do **not** rebuild the scanning/updating engine.

**Decision forks (user-approved):** thin wrapper + OS spec · rubric + template · on-demand
cadence · `CLAUDE-global.md` + lean repo `CLAUDE.md`, `GEMINI.md` left as-is.

---

## 3. Phase CMD-1 — The Standard *(Interface-First gate — requires sign-off)*

**Owner:** strategist (draft) → scribe (format). **Deps:** none.

| Action | File |
|:---|:---|
| NEW | `rules/common/claude-md-standards.md` — the canonical rubric |
| NEW | `templates/CLAUDE.md.template` — starter skeleton for new project CLAUDE.md files |
| EDIT | `CLAUDE.md` + `README.md` — register the new rule in the rules index |

**Rubric MUST contain:**
- **Global-vs-project content split table** — what belongs in `CLAUDE-global.md` vs a project `CLAUDE.md` (e.g. OS routing/agents/rules → global; repo build/test/deploy specifics → project).
- **≥5 scored quality dimensions** (e.g. size discipline, no rule-duplication, routing-table currency, precedence clarity, actionability).
- **≥4 named anti-patterns** (bloat, restating `rules/common/*`, stale routing tables, mixing global + project concerns).
- **Size caps** consistent with `rules/common/TOKEN-ECONOMICS.md`.

**Success:** rubric has the split table + ≥5 dimensions + ≥4 anti-patterns; template
instantiates to a valid <60-line skeleton; new rule registered in both indexes.

**Hard rules:** (a) MUST NOT duplicate content already in `rules/common/*` — reference,
never restate; (b) rubric size caps MUST be self-consistent with TOKEN-ECONOMICS.md.

---

## 4. Phase CMD-2 — The Split

**Owner:** coder (deploy.sh) + scribe (docs). **Deps:** CMD-1.

| Action | File |
|:---|:---|
| NEW | `CLAUDE-global.md` — current global OS content, refined to pass the CMD-1 rubric → the deployable |
| EDIT | `CLAUDE.md` — slim to repo-specific guidance (deploy.sh, tests, plugin/marketplace structure, this repo's Artifacts discipline) |
| EDIT | `scripts/deploy.sh:126` — copy `CLAUDE-global.md` → `~/.claude/CLAUDE.md` |
| EDIT | `DEPLOY.md` — update copy list + record |

**Success:** `deploy.sh` dry-run shows `~/.claude/CLAUDE.md` sourced from `CLAUDE-global.md`
with **zero content regressions** vs today's global (diff-verified); repo `CLAUDE.md` ≤ rubric
size cap and holds only repo-specific guidance.

**Hard rules:** (a) no global OS content silently dropped — every line removed from repo
`CLAUDE.md` lands in `CLAUDE-global.md`; (b) `deploy.sh` step-6 validation still passes.

---

## 5. Phase CMD-3 — The Command

**Owner:** auditor (quality-gate command, consistent with `/registry-audit`). **Deps:** CMD-2.

| Action | File |
|:---|:---|
| NEW | `commands/claude-md.md` — thin `/claude-md`: invokes `claude-md-improver` pointed at `rules/common/claude-md-standards.md`; on-demand audit + targeted update (report-first, edits only on confirm) |
| EDIT | `CLAUDE.md` + `README.md` — register `/claude-md` in the command tables |
| TEST | `/registry-audit` — confirm all cross-references resolve |

**Success:** `/claude-md` produces a rubric-scored report for a target CLAUDE.md and applies
approved edits; `/registry-audit` returns 0 broken references.

**Hard rules:** (a) MUST NOT auto-edit without confirmation (on-demand cadence);
(b) MUST reuse the existing plugin — no reimplemented scanner.

---

## 6. Dependency Order & Scope

```
CMD-1 (Standard) ──▶ CMD-2 (Split) ──▶ CMD-3 (Command)
   the contract       writes to it        references it
```

- **Files touched (total):** ~8 across 3 phases. No new dependencies. No engine build.
- **Out of scope:** `GEMINI.md` split; rebuilding the scan/update mechanism; automating self-edits.

## 7. Git

- **Branch:** `phase-cmd-1-claude-md-standard` (created).
- **Merge gate (per phase):** auditor marks the phase's final task `[x]` and success metrics met.
- **Cleanup:** delete branch after CMD-3 merge (or re-branch per phase if preferred).
