# Global Learnings Inbox

Cross-project lessons awaiting graduation into global rules, skills, or standards.

**Workflow**: Project sessions append entries here via `/learn --global`. Run `/graduate` in this repo to triage them into the correct files.

---

## Audit Session Learnings (2026-04-16)

### Parallel Team Review Pattern
**What:** Using `--team` flag enables 3 specialist agents (Compliance, Domain, Risk) to review in parallel.

**Why:** Significantly faster and deeper code review than sequential scanning.

**How to apply:** Always use `--team` flag for full audits; fallback to single agent only if token limits hit.

---

### Audit Health Score Formula
**What:** Overall health = weighted average across 5 dimensions.

**Formula:** `Architecture (20%) + Code Quality (15%) + Test Coverage (25%) + Documentation (15%) + Compliance (25%)`

**Score Range:** 0-100 (90+ = Good, 80-89 = Acceptable, <80 = Needs Work)

**How to apply:** Reference this formula when tracking project health over time.

---

### State File Health Check
**What:** Verify all state files healthy and synchronized before ending session.

**Files to Check:**
- `.agent/current_task.md` — Updated with current task status
- `TODO.md` — Active task markers correct
- `IMPLEMENTATION_PLAN.md` — No unnecessary changes
- `ARCH.md` — Stable
- `DECISION_LOG.md` — Stable

**How to apply:** Always verify state file consistency before ending session to prevent context loss.

---

## [END OF GLOBAL INBOX]
