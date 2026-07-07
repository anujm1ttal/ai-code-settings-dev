# Phase OSH-6: Tooling & Repo Hygiene

**Initiative:** OSH — OS Hardening · **Findings:** AUDIT_REPORT.md §6 (TL-*), HK-M5 residue, CM-13 script half
**Branch:** `phase-osh-6-tooling-hygiene` · **Owner:** coder → auditor

## Objectives

Dev tooling tells the truth (router returns correct models, deploy does what docs say, tests
that are advertised exist), and the repo obeys its own hygiene rules (Artifacts root archived,
single tracked casing, no dead flags).

## Technical Approach

**model_router.py (TL-H1/M9):** adopt the model_routing_audit.py pattern — parse
`agents/*.md` + SKILL.md frontmatter live instead of hardcoding tables. Minimum viable fix:
add `optional_plugins/*/skills/<name>/SKILL.md` as a second lookup root and replace
`except Exception: pass` with targeted exceptions. Preferred fix (implement if <2h): frontmatter-
driven lookup with the hardcoded dicts reduced to tier/pricing constants. Coder picks based on
effort; auditor gates on the acceptance test either way:
`--lookup skill manuscript-review scribe` → sonnet.

**deploy.sh (TL-H2/M3/M4/L1/L2):** drop `optional_plugins` from the copy loop (real installs
live in `~/.claude/plugins/` via marketplace) and delete the stale `~/.claude/optional_plugins/`
copy; scope backups to only the deployed dirs/files + prune to last 5; make `--force` real
(skip the confirmation prompt) or remove it from parser + docs; fix the unreachable pytest-hint
(`set -e` guard); remove the vestigial `$DEST/scripts` mkdir. Hooks copy step already landed in
OSH-1 — verify only.

**Tests (TL-M1):** minimal real suite: (a) `model_router` lookup matrix incl. the
manuscript-review regression; (b) `model_routing_audit` frontmatter parsing on fixture files;
(c) hook smoke tests shelling `node hooks/<x>.js` with piped JSON asserting schema + fail-open
(mirrors OSH-1 evidence, now regression-locked); (d) a registry-integrity test: every command
in CLAUDE-global's table has a file and vice versa. Keep it <200 lines total; pytest + subprocess.

**Artifacts hygiene (TL-H4/M2/L8):** archive sweep to `Artifacts/History/` (created-as-needed
subfolders): PHASE_11_* ×3, SKILL_AUDIT/REGISTRY/OPTIMIZATION ×3, REGISTRY_HEALTH_REPORT,
NEXT_SESSION_plugin-registry-gap, SNAPSHOT, WALKTHROUGH ×2, anthropic_skills_analysis,
ROLLBACK_PROCEDURE, CMD-Plan.md (→ History/Plans/). Delete stale `task.md` (superseded by
`.agent/current_task.md`) and empty `SESSIONS/`. `git rm --cached Artifacts/Temp/scratch_test.md`
(already deleted on disk). **NEXT_SESSION content check before archiving**: it references the
retired plugin gap — confirm resolved, note in DECISION_LOG if it carries anything live.

## File Changes

| File | Edit | Findings |
|:---|:---|:---|
| `scripts/model_router.py` | Plugin-root lookup (or frontmatter-driven); targeted exceptions; `Optional[...]` → `T \| None`. | TL-H1, TL-M9, TL-L7 |
| `scripts/skill_graph_analyzer.py` | Honest types (`dict[ProjectType, set[str]]`), delete dead identical-branch conditional (:212) + isinstance guards, remove unused `TypedDict`/`json` imports; scan `optional_plugins/*/skills/` too (script half of CM-13). | TL-M7 |
| `scripts/deploy.sh` | Drop optional_plugins from loop + mkdir; backup scope + prune(5); `--force` real-or-removed; pytest-hint fix; drop $DEST/scripts mkdir. | TL-H2, M3, M4, L1, L2 |
| `~/.claude/optional_plugins/` | DELETE stale deployed copy. **[user-approval]** — production dir removal. | TL-H2 |
| `DEPLOY.md` | Mirror deploy.sh reality (incl. hooks step from OSH-1, no-plugins, backup scope); delete phantom script refs (:49-50); fix the manual-copy snippet to rm-before-cp (:26-30). | TL-M5 |
| `cheatsheet.md` | Remove dead migration-script ref (:293); pytest section → new suite; add 9 missing commands to intent table. | TL-M6 |
| `CLAUDE.md` (repo) | skill_graph_analyzer invocation with root arg; `--force` doc per decision; test command per new suite. | TL-M8, TL-M3 |
| `tests/` | New: `test_model_router.py`, `test_routing_audit_parsing.py`, `test_hooks_smoke.py`, `test_registry_integrity.py`. | TL-M1 |
| `templates/Phase-N-Plan.md.template` | Add "## Hard Rules (2–3)" section. | TL-L4 |
| `templates/README.md` | Add CLAUDE.md.template row. | TL-L5 |
| `.gitattributes` | NEW: `*.md text eol=lf` (or `* text=auto`) to end CRLF-only deploy diffs. | TL-L6 |
| Artifacts root | Archive sweep + deletions per Approach; `git rm --cached` Temp file. | TL-H4, TL-M2, TL-L8 |
| local disk | Delete stale `__pycache__` ghosts (untracked; no commit). | TL-L3 |

## Dependencies

**Prerequisites:** OSH-1 (deploy.sh hooks step exists), OSH-3 (History/ casing settled — the
sweep lands in the canonical dir), OSH-5 (scripts/README.md already holds routing reference;
cheatsheet edits won't collide).
**Enablements:** trustworthy dev loop; CI-able test suite.

## Verification

- `python scripts/model_router.py --lookup skill manuscript-review scribe` → sonnet (fresh output).
- `pytest tests/ -v` → all pass, exit 0 (this time with actual tests; count ≥ 8).
- `bash scripts/deploy.sh` full run → validation passes; `~/.claude/optional_plugins/` absent; backup size < 10 MB; ≤5 backups retained.
- `Get-ChildItem Artifacts` root shows only schema-recognized files/dirs.
- `git status` clean of the Temp `D` entry.

## Hard Rules (Auditor Rejects on Violation)

1. Archive sweep **moves** files (git mv) — never deletes content, except the two enumerated deletions (task.md, SESSIONS/) and the cached-Temp untrack.
2. Tests must fail when the defect they lock is reintroduced (spot-check: revert model_router fix locally → test fails).
3. No behavior change to deployed OS content in this phase — scripts/docs/tests/hygiene only.

## Success Metrics

- [ ] Router regression test green; manuscript-review → sonnet
- [ ] `pytest tests/ -v` ≥ 8 tests, exit 0
- [ ] deploy.sh ↔ DEPLOY.md ↔ CLAUDE.md fully agree (spot-audit)
- [ ] Artifacts root schema-clean; single History/ casing holds all archives
- [ ] Auditor PASS
