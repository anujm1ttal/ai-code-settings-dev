# DLR Plan — DECISION_LOG Rotation

**Initiative:** DLR — DECISION_LOG Rotation · **Owner:** strategist · **Implementer:** coder · **Gate:** auditor
**Branch:** `phase-dlr-decision-log-rotation` · **Type:** `code` (AI OS meta-repo policy) · **Deploys:** yes
**Step 0 approved:** 2026-07-08 · **Grill:** skipped (spec <50 lines, low-risk policy text)

## Purpose

DECISION_LOG grows unbounded — the OS defines lifecycle for Plans/Reports (archive at
phase-close) and learnings (50-entry prune) but is **silent on DECISION_LOG**, so it bloats by
omission (observed: a 7000-line log in one project). DECISION_LOG is an **immutable audit trail**
(ADR-style), not a heuristics cache — so the fix is **rotation, never prune**: keep the active
log lean, move old resolved entries to a grep-able archive, delete nothing.

## Binding decisions (Step 0 — coder does not re-litigate)

| # | Decision | Rationale |
|:--|:---|:---|
| B1 | **Trigger = size threshold** (>400 lines OR >40 entries), not initiative-close | Universal — fires in loose code projects with no initiative boundaries (the 7000-line case). User-selected. |
| B2 | **Archive = single rolling `History/DECISION_LOG-archive.md`**, newest-first | One grep answers any "why is it like this?"; no fragmentation. User-selected. |
| B3 | **Rotate oldest RESOLVED only**; UNRESOLVED never rotate regardless of age | Open items must stay visible in the active log. |
| B4 | **This repo does NOT rotate now** — 115 lines / 11 entries, under threshold | Force-moving would violate B1 on first application. Scaffold + pointer only. |
| B5 | **Trigger owner = concierge at `/handoff`**; manual via `/clean` | Handoff already touches state files; natural rotation checkpoint. |

## Tasks — Technical Approach

### T1 — Rotation rule (coder) — `rules/common/orchestration.md`
- Add a **DECISION_LOG Rotation** policy to the Persistence section (near the phase-lifecycle
  rules). State: threshold (>400 lines OR >40 entries) → move oldest **resolved** entries to
  `Artifacts/History/DECISION_LOG-archive.md` (prepend, newest-first); keep all unresolved +
  recent; **never delete**; add/maintain a forward-pointer line at the top of the active log.
  Trigger: concierge at `/handoff` (manual via `/clean`).
- Update the DECISION_LOG persistence-table row to reference the rotation policy (mirror the
  learnings row's "50-entry prune" phrasing style).

### T2 — Read-discipline (coder) — `commands/sync.md` + `commands/handoff.md`
- `sync.md`: where it reads DECISION_LOG (Step 4 validation), instruct **newest-first head read
  + unresolved scan**, not full-file. It already says "unresolved entries" — make the *how*
  explicit (log is newest-first; read the head).
- `handoff.md`: where it appends to DECISION_LOG (Step 3), add the rotation check (per B5) and
  the head-read discipline.

### T3 — Scaffold, no move (coder)
- Create `Artifacts/History/DECISION_LOG-archive.md`: header + back-pointer to active log +
  a "rotated here when active log >400 lines" note. Empty of entries (nothing rotates yet).
- Add a forward-pointer line at the top of `Artifacts/DECISION_LOG.md` → the archive.
- **Do NOT move** the 11 current entries (B4). Document the no-op in the phase report.

### T4 — Gate + deploy (auditor)
- Verify M1–M4; run `bash scripts/deploy.sh` (deploy-guard + 105 tests); merge ff to `main`.

## Success Metrics (auditor gate)

| # | Metric |
|:--|:---|
| M1 | `orchestration.md` states DLR with explicit numeric threshold + archive path + never-delete + trigger owner (grep-verifiable) |
| M2 | `sync.md` AND `handoff.md` each specify newest-first/head read of DECISION_LOG; zero "read the whole log" phrasing |
| M3 | `History/DECISION_LOG-archive.md` exists w/ back-pointer; active log has forward-pointer; **11 entries remain** (rotation no-ops under threshold) |
| M4 | `deploy.sh` green (6/6, guard passes, 105 tests); updated rules/commands live in `~/.claude/` |

## Hard Rules (Auditor Rejects on Violation)

1. Rotation **NEVER deletes** — entries only move to History/; the archive is append-only.
2. **UNRESOLVED entries never rotate**, regardless of age.
3. **No behavioral loss** — head-read must still surface unresolved items; this repo's
   under-threshold entries are **not** force-moved (policy coherence, B4).
