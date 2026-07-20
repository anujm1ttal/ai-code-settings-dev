# OXL-3 TODO — Interview Mode (`/blueprint --interview`)

**Branch:** `phase-oxl-3-interview-mode` · **Plan:** `Artifacts/Plans/OXL-3-Plan.md`
**Status authority:** coder `[-]` · auditor `[x]` · strategist structure only (see `orchestration.md`)

---

## Phase 1 — Elicitation content

- [x] [strategist] T1: Rewrite `skills/business-analyst/references/elicitation-guide.md` (23 → ≤70 lines) — depth traversal, codebase-first budget (R2), recommendation protocol (R3), termination test (R1), worked example — Success: ≤70 lines; all 4 breadth categories present verbatim (zero deletions); ≥1 worked traversal with ≥4 dependency-ordered questions; R1/R2/R3 each traceable to a named line — Mode: AFK
- [x] [strategist] T2: File `oxl_interview_alias` in `Artifacts/BACKLOG.md` (thin `/interview` → `/blueprint --interview` alias; LOW; revival trigger = user reaches for a standalone entrypoint twice in real use) — Success: entry mirrors `oxl_wayfinder_1` format; both entries cross-reference each other; entry states explicitly OUT of OXL-3 scope — Mode: AFK

## Phase 2 — Entrypoint wiring

- [x] [coder] T3: `commands/blueprint.md` — `argument-hint` (L4) gains `[--interview]`; step 2 (L22) becomes a two-branch conditional (default 3–5 breadth / `--interview` → depth traversal per guide §2) — Success: file ≤70 lines (from 58); default branch byte-identical to today's L22 (HR1) — Blocked by: T1 — Mode: AFK
- [x] [coder] T4: `agents/strategist.md` L19-28 — one sentence: the MUST-run Step 1 gate is satisfied by *either* mode — Success: file ≤85 lines (from 80); no new mandatory question on any path — Blocked by: T1 — Mode: AFK
- [x] [coder] T5: `cheatsheet.md` — add 1 row to the Commands-by-Intent table (L11-34) for the interview mode — Success: exactly 1 row added; 0 rows altered — Blocked by: T1 — Mode: AFK
- [x] [auditor] T6: Hard Rule 3 surface check + test run — Success: `git diff --name-only` lists exactly 3 files for T3-T5; 0 new files; `grep -c` for new rows in `CLAUDE-global.md`, `GEMINI.md`, `orchestration.md` §Automatic Routing = 0; `pytest tests/ -v` exit 0 — Blocked by: T3, T4, T5

## Phase 3 — Deploy + live-fire

- [ ] [coder] T7: `bash scripts/deploy.sh` — Success: exit 0, 6/6 validation steps pass — Mode: HITL
- [ ] [auditor] T8: Live-fire one real `/blueprint --interview` against a genuinely foggy idea — Success: signed restatement reached in ≤12 questions; ≥2 questions answered by codebase exploration instead of asking; no single question exceeded the 2-tool-call budget (R2) — Blocked by: T7 — Mode: HITL
- [ ] [auditor] T9: Regression — re-run default `/blueprint` (no flag) — Success: 3–5 bounded breadth questions, behavior unchanged vs pre-OXL-3 (HR1) — Blocked by: T7 — Mode: HITL
- [ ] [user-approval] T10: **R3 HARD GATE** — user affirms the T8 restatement is *their* idea, not the model's — Success: unqualified affirmation. **A hedged, qualified, or soft yes = FAIL.** On FAIL: return to T1, harden guide §4, do not merge — Blocked by: T8 — Mode: HITL
- [ ] [auditor] T11: Phase close — verify all metrics, authorize merge to `main`, delete branch — Success: T1-T10 all `[x]`; merge commit on `main`; branch deleted — Blocked by: T6, T9, T10 — Mode: HITL

---

## Notes

- T3/T4/T5 all depend on T1 only, not on each other — parallel-eligible, single-owner per file (no shared-file writes).
- T10 is the gate the feature lives or dies on. By Phase 3 the user is invested and inclined to wave it through; that inclination *is* the anchoring failure R3 predicts. Auditor must not accept a soft yes.
- `oxl_interview_alias` (T2) is filed as deferred work only — implementing it inside OXL-3 violates Hard Rule 3.
