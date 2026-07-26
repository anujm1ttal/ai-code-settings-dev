# BLR-1: BACKLOG Lifecycle & Rotation

**Initiative:** BLR — BACKLOG Lifecycle & Rotation · **Type:** `code` · **Owner:** strategist → coder → auditor
**Step 0 approved:** 2026-07-26 · **Grill:** [REFACTORED] 2026-07-26 · **Branch:** `phase-blr-1-backlog-lifecycle`
**Origin:** user compared this repo's BACKLOG against `my_mcp_rhino`'s to find what the OS was missing.

---

## Objectives

Give `Artifacts/BACKLOG.md` the lifecycle the OS never defined. Entry is well-specified in three
places (Findings Protocol, auditor routing, high-rigor scope discipline); **exit is specified
nowhere**. Close that with a size-controlled rotation rule plus a mechanical checker — not more prose.

Measurable outcome: this repo's own BACKLOG drops 343 → ~190 lines, 18 → 11 entries, and
`scripts/backlog_audit.py` exits 0 against it.

---

## Evidence (why this exists)

| Repo | Symptom | Measured |
|:---|:---|:---|
| ai-code-settings | Resolved entries never rotate | **7 of 18** marked RESOLVED/CLOSED/GRADUATED, all still in the active file (39%) — count from `backlog_audit.py`, not by hand |
| my_mcp_rhino | Per-phase findings dumps + a reference doc squatting inside | **1228 lines**; 17 dated `## N. Phase X findings` sections; §5c = 465 lines (38%) that `CLAUDE.md` cites as authoritative |
| Both | Independently improvised the missing mechanism, **differently** | ai-code-settings grew per-entry `Needs:` fields; my_mcp_rhino grew blocker-grouping + 3 hand-rolled archives |

Convergent improvisation across two independent repos means the gap is the OS's, not the projects'.

---

## The grill reframe (binding — do not re-litigate)

The Step 0 draft treated BACKLOG as a **work queue** and proposed a consume point plus per-entry
revival triggers. The user's own data refuted it:

- **8 of 11** open entries already carry a `**Needs:**` field. **Zero** caused a pickup.
- Three entries reading `Needs: doc pass` have sat **17–19 days**.
- User, asked what actually causes a pickup: *"It doesn't get picked up"* — items that got done
  were forced by unrelated work.

**BACKLOG's evidenced job is searchable institutional memory, not a queue.** Its two real returns,
both observable in the current file:

1. **Not losing analysis** — `oxl_routing-violations_1` holds a 4-session breakdown of 21 routing
   violations that would cost ~1h to re-derive.
2. **Not re-litigating** — `oxl_wayfinder_1` records why wayfinder was cut, and `OXL-3-Plan.md`
   cites it to avoid shipping a duplicate foggy-input mode. That already paid off once.

Therefore optimize for **findability and size**, not scheduling.

**Struck at grill** (recorded so it is not re-proposed):
- 4-group blocker taxonomy — rationale was "when does it come out"; refuted.
- `Exit:` trigger vocabulary (`trigger:`/`decision:`/`batch:`/`step-0`) — replaced by a plain
  `OPEN`/`RESOLVED` marker, which is all rotation needs.
- A `/blueprint` consume point — wishful thinking per the diagnostic above.
- Symbol-citation requirement — `standards.md` §Documentation Visuals already mandates it.
- Restating the prohibition at `orchestration.md:364` / the intake rule at `:365` — both were
  **already live and in force** while all the damage above accumulated. More prose is not the fix.

---

## Technical Approach

Model on **DLR** (DECISION_LOG Rotation, 2026-07-08, `ca03928`) — the closest precedent: same
artifact class, same growth pattern, shipped in one phase with auditor first-pass PASS. Its
rotation mechanism holds *because `/handoff` mechanically checks a numeric threshold*, not because
the rule is well-worded.

Mechanical enforcement is this OS's proven pattern (LH thesis: *"a rule the harness enforces beats
one the model chooses to obey"*) — see `model_routing_audit.py`, `gate_telemetry.py`,
`deploy.sh`'s enforced-hook guard, `/registry-audit`.

### Known limitation — surfaced, not resolved

`deploy.sh` excludes `scripts/`, so `backlog_audit.py` is **repo-local to ai-code-settings** and
does nothing for `my_mcp_rhino`. This is the identical gap already recorded as BACKLOG entry
`lh3_telemetry-deploy_1` (gate telemetry reader is repo-local; hooks log everywhere).

**Not resolved here** — it is a deferred product decision and pulling it in is scope creep.
Mitigations: (a) the script takes **zero repo imports** so any project can copy it standalone;
(b) `/handoff` wiring reuses the existing graceful-skip pattern (`test -f scripts/... && ...`)
already proven for `gate_telemetry.py`, so no new deploy policy is introduced.

---

## File Changes

| File | Change |
|:---|:---|
| `rules/common/orchestration.md` | BACKLOG persistence row reworded; new **§BACKLOG Lifecycle** (≤20 lines) — contract + rotation + 1-line eviction clause |
| `scripts/backlog_audit.py` | **NEW** — stdlib-only checker, zero repo imports |
| `tests/test_backlog_audit.py` | **NEW** — parser + threshold + exit-code tests |
| `commands/handoff.md` | Hygiene Phase gains rotation-check + audit invocation (graceful-skip pattern) |
| `Artifacts/BACKLOG.md` | T4 dogfood migration — 8 resolved entries rotated out |
| `Artifacts/History/BACKLOG-archive.md` | **NEW** — rotation destination |
| `scripts/README.md` | Register `backlog_audit.py` |

---

## Task Detail

### T1 — BACKLOG contract (`orchestration.md`)

Reword the persistence-table row and add **§BACKLOG Lifecycle**, capped at **20 lines**:

- States the contract: **searchable memory of deferred work and decisions-not-to-do — not a queue.**
  Nothing schedules off it; items surface when the underlying thing resurfaces.
- Requires per entry: a **stable ID** (`<phase>_<component>_<n>`, already the convention) and a
  **status marker** (`OPEN` / `RESOLVED`). The status marker is what makes rotation mechanical.
- Explicitly notes grouping/ordering is **project-local and unconstrained** — my_mcp_rhino's
  "Blocked on Phase 17" group is legitimately project-specific; the OS must not close that set.

### T2 — Rotation (same §)

DLR clone, deliberately parallel so the two rules read as siblings:

- **Trigger:** active `BACKLOG.md` exceeds **>250 lines OR >20 entries**.
- **Action:** move oldest **RESOLVED** entries to `Artifacts/History/BACKLOG-archive.md`
  (prepend, newest-first) until back under threshold.
- **Never delete** — archive is append-only. **OPEN entries never rotate**, regardless of age.
- Forward-pointer line at the top of the active file → archive.
- **Eviction clause (1 line):** an entry another durable doc cites as authoritative is a
  *reference*, not backlog — extract it to its own artifact rather than rotating it.
  (Grounded in my_mcp_rhino §5c: 465 lines, cited by that repo's `CLAUDE.md`.)
- **Trigger owner:** concierge at `/handoff`; manual via `/clean`.

### T3 — `scripts/backlog_audit.py`

Stdlib-only, **zero repo imports**, read-only. Reports:

| Check | Output |
|:---|:---|
| Unrotated RESOLVED entries | count + IDs, when over threshold |
| Entries missing a status marker | count + IDs |
| Size vs threshold | `N lines / M entries` against 250/20 |
| Per-phase-dump sections | headings matching `^##\s*\d+[a-z]?\.\s.*findings` — the my_mcp_rhino shape |

`--violations-only` flag mirroring `model_routing_audit.py`. **Exit 1 on any violation, 0 clean.**
Wired into `/handoff` Hygiene Phase with the `gate_telemetry.py` graceful-skip pattern.

### T4 — Dogfood migration

Apply T1–T2 to this repo's own `Artifacts/BACKLOG.md`. The 7 rotation-eligible entries:
`lh3_gate-log_1`, `vse1_palette_1`, `vse1_templates_1`, `osh_hooks-gaps_1..4`,
`osa_model-routing_1`, `osa_plugin-docs_2`, `osa_plugin-scope_3`.
The 11 OPEN entries stay and gain status markers.

**This is the acceptance test.** An unapplied rule is an untested rule.

---

## Dependencies

**Prerequisites:** none — runs independently of OXL. Precedent for out-of-sequence initiatives:
RDT, GHP, MTU, EVD.

**Enablements:** unblocks a future `/clean --backlog` or hook-level enforcement; supplies the
second data point (after `gate_telemetry.py`) for resolving `lh3_telemetry-deploy_1`.

**State note (drift, flagged not fixed):** `TODO.md` marks **OXL-3** `[ ]` citing active branch
`phase-oxl-3-interview-mode`, but that branch does not exist and its deliverables are on `main`
(`skills/business-analyst/references/elicitation-guide.md`; `--interview` wired in
`commands/blueprint.md`). Auditor-owned resolution — only the auditor may mark `[x]`, and OXL-3's
R3 live-fire gate may genuinely be unmet.

---

## Hard Rules (Auditor Rejects on Violation)

1. **No BACKLOG outside this repo is touched.** T4 dogfoods `ai-code-settings` only; no
   auto-migration of `my_mcp_rhino` or any other project.
2. **Rotation never deletes.** `History/BACKLOG-archive.md` is append-only; OPEN entries never
   rotate regardless of age.
3. **`backlog_audit.py` reports, never edits.** No auto-rotation. Mutation stays human-confirmed,
   matching `/clean`'s no-deletion-without-confirmation rule.

---

## Success Metrics

- [ ] M1: `orchestration.md` §BACKLOG Lifecycle **≤20 lines**; rotation threshold numeric; archive
      path named; never-delete invariant present
- [ ] M2: `scripts/backlog_audit.py` — **zero repo imports** (`grep -c "^from \|^import " | stdlib only`);
      `--violations-only` flag present; exits 1 on violation, 0 clean
- [ ] M3: `Artifacts/BACKLOG.md` **≤200 lines and ≤12 entries** (from 343/18); 7 entries present in
      `History/BACKLOG-archive.md`; **zero** RESOLVED entries remain in the active file
- [ ] M4: `python scripts/backlog_audit.py` against this repo → **exit 0**
- [ ] M5: `python -m pytest tests/ -q` → **exit 0**, including new `test_backlog_audit.py`
- [ ] M6: `bash scripts/deploy.sh` → **6/6 validation pass**
- [ ] M7: Auditor PASS on Logic, Style, and all 3 Hard Rules
