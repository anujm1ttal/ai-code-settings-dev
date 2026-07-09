# DLR Report — DECISION_LOG Rotation (CLOSED)

**Plan:** `Artifacts/Plans/DLR-Plan.md` · **TODO:** `Artifacts/Plans/DLR-TODO.md`
**Branch:** `phase-dlr-decision-log-rotation` · **Gate:** auditor · **Verdict:** PASS — merged to `main`

## Summary

The OS defined lifecycle for Plans/Reports (archive at phase-close) and learnings (50-entry
prune) but was silent on `DECISION_LOG.md`, letting it bloat by omission. This initiative added
a rotation (never-prune) policy: threshold trigger, oldest-resolved-first archival to a single
rolling `History/DECISION_LOG-archive.md`, unresolved entries always retained, concierge owns
the trigger at `/handoff`. This repo's own log (11 entries / 117 lines) stays under threshold,
so T3 scaffolds the archive without moving anything — proving the policy correctly no-ops
rather than force-migrating data to satisfy the initiative.

## Metric Evidence (adversarial verification, not coder self-report)

### M1 — `orchestration.md` rotation policy

Verified via `git diff rules/common/orchestration.md`:
- New **DECISION_LOG Rotation** block under Persistence states: trigger `>400 lines OR >40
  entries`; action = move oldest RESOLVED entries to `Artifacts/History/DECISION_LOG-archive.md`
  (prepend, newest-first preserved); unresolved entries never rotate; **never delete** (archive
  is append-only); forward-pointer maintained at top of active log; trigger owner = concierge
  at `/handoff` (manual via `/clean`).
- Persistence-table `DECISION_LOG` row updated: "Rotates (never prunes) past threshold — see
  **DECISION_LOG Rotation** below." Mirrors the learnings-row phrasing style as specified.

**PASS** — all four required elements (numeric threshold, archive path, never-delete, trigger
owner) present and grep-verifiable.

### M2 — Read-discipline in `sync.md` and `handoff.md`

`git diff commands/sync.md`: Step 4 now reads "the log is newest-first: read the **head**
(recent entries) and scan for unresolved, not the whole file."

`git diff commands/handoff.md`: Step 3 now reads "(log is newest-first: read the head, not the
whole file, when checking prior entries)" **and** adds a rotation check: "after appending, if
the active log exceeds >400 lines OR >40 entries, rotate the oldest RESOLVED entries to
`Artifacts/History/DECISION_LOG-archive.md` (prepend, newest-first preserved; unresolved
entries never rotate; never delete)."

Confirmed zero "read the whole log" (or equivalent full-file-read) phrasing remains in either
file via `grep -rn "read the whole"` → no matches.

**PASS** — both files specify head-read; handoff.md Step 3 carries the rotation check.

### M3 — Archive scaffold + entry-count invariant

- `Artifacts/History/DECISION_LOG-archive.md` exists (verified staged under the canonical
  capital-`History/` path — see Casing Check below) with header, back-pointer to the active
  log, and the "rotated here when active log >400 lines" note. Zero entries — correct, since
  nothing should have moved.
- `Artifacts/DECISION_LOG.md` carries a forward-pointer: "Archive of rotated entries →
  `Artifacts/History/DECISION_LOG-archive.md`."
- `grep -c '^## ' Artifacts/DECISION_LOG.md` → **11** (matches pre-task count exactly — ran
  this myself, not accepted from the coder's claim). Confirms rotation correctly no-op'd under
  threshold; no entries were force-moved to make the initiative "look done."

**PASS**.

### M4 — Deploy

Ran `bash scripts/deploy.sh` myself after M1–M3 passed:

```
[1/6] Validating source repository...        OK
[2/6] Running test suite...                  105 passed in 20.79s
[3/6] Checking destination (~/.claude/)...   OK
[4/6] Creating backup...                     OK (pruned to last 5)
[5/6] Copying production artifacts...        OK
[6/6] Validating deployment...               OK: all 7 enforced hook(s) present and wired.
DEPLOYMENT COMPLETE
```

Post-deploy `diff` of the three edited files (repo copy vs `~/.claude/`) returned no output for
`orchestration.md`, `commands/sync.md`, `commands/handoff.md` — confirmed byte-identical, i.e.
live in production.

**PASS** — 6/6 steps, deploy-guard confirmed all 7 hooks wired, 105/105 tests green.

## Casing Check (known footgun — confirmed avoided)

`git status --short` initially showed the new archive as untracked at lowercase
`Artifacts/history/DECISION_LOG-archive.md` (Windows case-insensitive filesystem artifact —
the physical directory is shared with the already-tracked capital `Artifacts/History/*` files,
but git's case-sensitive index saw the coder's lowercase path as a new, different file).

Remediated before commit: ran `git add "Artifacts/History/DECISION_LOG-archive.md"` explicitly
with the canonical capital path, then confirmed via `git diff --cached --name-only` that the
staged path reads `Artifacts/History/DECISION_LOG-archive.md` (capital H). No lowercase
`Artifacts/history/` path was committed. Repo's OSH-3 capital-`History/` convention held.

## Hard Rules — Confirmed Held

1. **Rotation never deletes** — `orchestration.md` policy text states "never delete... archive
   is append-only"; no delete path exists anywhere in the change. HELD.
2. **Unresolved entries never rotate** — stated explicitly in both the policy (`orchestration.md`)
   and the mechanism description (`handoff.md` Step 3). HELD.
3. **No behavioral loss; under-threshold entries not force-moved** — `sync.md`/`handoff.md`
   head-read still surfaces unresolved entries (unresolved entries live at/near the head by
   construction since the log is newest-first and nothing rotates while under threshold); the
   11 pre-existing entries were verified unchanged (M3). HELD.

## Verdict

**PASS.** All 4 success metrics met with first-hand verification (not coder self-report). All 3
Hard Rules held. Deploy green. Initiative CLOSED.

## Actions Taken

1. Marked T1–T4 `[x]` in `Artifacts/Plans/DLR-TODO.md`.
2. Marked T1–T4 `[x]` and set initiative status to `COMPLETE` in `Artifacts/TODO.md`.
3. Committed coder's implementation (5 files: `Artifacts/DECISION_LOG.md`,
   `Artifacts/History/DECISION_LOG-archive.md`, `commands/handoff.md`, `commands/sync.md`,
   `rules/common/orchestration.md`) as `d36cfbd` on `phase-dlr-decision-log-rotation`.
4. Merged `phase-dlr-decision-log-rotation` → `main` (fast-forward), deleted the phase branch.
5. Pushed `main` to origin.

## Deferred / Notes

- None. This initiative was scoped tight (spec <50 lines, no `/grill`) and closed clean on the
  first gate pass — no rework loop, no escalation.
