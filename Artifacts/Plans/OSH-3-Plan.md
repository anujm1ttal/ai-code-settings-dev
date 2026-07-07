# Phase OSH-3: One Name for Every State File

**Initiative:** OSH — OS Hardening · **Findings:** AUDIT_REPORT.md §4 (RU-F1..F5, F9, F10), CM-4, CM-15, TL-H5
**Branch:** `phase-osh-3-naming-unification` · **Owner:** coder → auditor

## Objectives

Every state-file name, casing, and lifecycle destination agrees across the entire corpus.
Today an agent following CLAUDE-global writes the decision log into the archive, /learn's
picker text names a dead file, and **both** `Artifacts/History/` and `Artifacts/history/` are
git-tracked (case-collision on any non-NTFS checkout).

## Canonical Decisions (implement exactly these)

| Concept | Canonical | Retired forms |
|:---|:---|:---|
| Learnings registry | `Artifacts/learnings/` (directory, `index.md` entry point) | `Artifacts/LEARNINGS.md` |
| Findings/deferred-work home | `Artifacts/BACKLOG.md`; promotion to learnings happens at `/handoff` | `Artifacts/findings.md`; promotion at `/sync` |
| Archive directory | `Artifacts/History/` with `Plans/` + `Reports/` subdirs; archived files keep their names (`Phase-N-Plan.md`) | `Artifacts/history/`; `PLAN_Phase_[N].md` / `TODO_phase_[n].md` renaming schemes |
| Decision log | `Artifacts/DECISION_LOG.md` at **root** (live, append-only; never archived wholesale) | Archive listing in CLAUDE-global |
| Handoff brief | `Artifacts/HANDOFF_BRIEF.md` at root (current brief); superseded briefs → `History/` | "/handoff writes to history/" ambiguity |
| Rubric name | "Approval Rubric" (standards.md heading) | "Approval Label Rubric" |

Rationale — `History/` over `history/`: CLAUDE-global's `History/Plans|Reports` layout matches
the Phase-N template scheme and the existing `History/Plans/Phase-OSA-Plan.md`; keep-names
beats rename-on-archive (greppable, no mapping logic).

## File Changes

| File | Edit | Findings |
|:---|:---|:---|
| `rules/common/orchestration.md` | `:18` fleet concierge Write → `Artifacts/learnings/`; `:85` /learn row → `Artifacts/learnings/`; `:257` "project-specific `LEARNINGS.md`" → "project-specific `Artifacts/learnings/`". Casing: `:78,187,239,309` `history/` → `History/`; `:239` archive naming → "moved to `Artifacts/History/Plans/Phase-[N]-Plan.md`". `:161` "Approval Label Rubric" → "Approval Rubric". `:78` /handoff row → "Writes `Artifacts/HANDOFF_BRIEF.md`; archives to `Artifacts/History/`". Hardcoded GLOBAL_INBOX machine path `:256` → "the ai-code-settings repo's `Artifacts/GLOBAL_INBOX.md`". | RU-F1, RU-F4, RU-F9, RU-F10, RU-S3 |
| `rules/common/TOKEN-ECONOMICS.md` | Rewrite "The Finding Protocol" (:48-53): findings → `Artifacts/BACKLOG.md`; promotion during `/handoff` (delete `findings.md` + `/sync` claims); keep it 4 lines + pointer to orchestration §Findings Protocol. Fix ":9" header typo "token Estimate" → "Token Estimate". | RU-F2, RU-F12 |
| `CLAUDE-global.md` | Move `DECISION_LOG.md` from "### Archive (Artifacts/History/)" (:135-137) to Root Files list. Normalize `:181` `history/` → `History/`. (Full dedup of the persistence section is OSH-5 — here only correctness.) | RU-F3, RU-F4 |
| `CLAUDE.md` (repo) | `:65` `Artifacts/history/` → `Artifacts/History/`. | RU-F4 |
| `commands/learn.md` | Frontmatter description → `Artifacts/learnings/` (:2). Hardcoded machine path (:25) → repo-relative wording. | CM-4, CM-20 |
| `commands/handoff.md` | Archive steps 5/9 (:48,:54) → `Artifacts/History/Plans/Phase-N-Plan.md` / `History/Reports/` scheme; brief stays at root, prior brief moves to History/. | CM-15, RU-F10 |
| `rules/common/security.md` | Verify `:66` DECISION_LOG root path consistent (no change expected — confirm). | RU-F3 |
| `rules/common/coding-style.md` | `file:///c:/Users/...` testing-strategy link → relative `testing-strategy.md` reference. | RU-S3 |
| git index | `git mv Artifacts/history/PLAN_LLM_Council.md Artifacts/History/Plans/PLAN_LLM_Council.md` (two-step mv via temp name on NTFS for the dir casing); result: single tracked `Artifacts/History/`. | TL-H5 |
| `hooks/session-boot.js` | Confirm learnings path already fixed in OSH-1 (verify-only). | HK-H3 |

## Dependencies

**Prerequisites:** OSH-1 merged (session-boot already reads `learnings/index.md`; avoids editing the same file in two open branches). OSH-2 merged (concierge.abstract learnings fix landed there — verify, don't re-edit).
**Enablements:** OSH-4/5 registry + dedup work edits these same tables; naming must be settled first so those diffs are clean.

## Verification

```bash
grep -rn "LEARNINGS.md" rules/ commands/ agents/ CLAUDE-global.md CLAUDE.md   # → 0 (or explicit legacy-fallback note in session-boot only)
grep -rn "findings.md" rules/ commands/                                        # → 0
grep -rniE "Artifacts/history/" rules/ commands/ agents/ CLAUDE*.md | grep -v "Artifacts/History/"  # → 0
git ls-files | grep -i "artifacts/history" | sort                              # → single casing
grep -rn "Approval Label Rubric" rules/                                        # → 0
```
Save to `Artifacts/Temp/osh-3_verify.txt`.

## Hard Rules (Auditor Rejects on Violation)

1. **Names only** — no table restructuring, no dedup, no content moves between files (that is OSH-5). A diff hunk that does more than substitute a name/path/casing is scope violation.
2. The `git mv` must be done with `git mv` (index-level), never a filesystem rename alone — NTFS masks the collision.
3. Zero references to any retired form after the phase (grep matrix), except session-boot's explicit legacy fallback.

## Success Metrics

- [ ] Grep matrix all-zero (evidence file)
- [ ] `git ls-files` shows exactly one `Artifacts/History/` casing
- [ ] DECISION_LOG.md listed under Root Files in CLAUDE-global; archive section no longer names it
- [ ] Deploy passes; deployed rules match repo
- [ ] Auditor PASS
