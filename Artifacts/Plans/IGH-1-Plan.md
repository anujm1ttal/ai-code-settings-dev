# IGH-1: Mechanical Guards

**Initiative:** IGH — Insights-Guided Hardening · **Type:** `code` · **Owner:** strategist → coder → auditor
**Step 0 approved:** 2026-07-26 · **Grill:** [REFACTORED] 2026-07-26 · **Branch:** `phase-igh-1-mechanical-guards`
**Origin:** `/insights` telemetry over 141 sessions / 572h / 413 commits — an evidence base reasoning cannot produce.

---

## Objectives

Close the mechanically-enforceable gaps the telemetry identified, per the principle three
independent findings converged on this session: **prefer a checker over a rule.**

Scope is deliberately small. Every item below is either evidence-backed at n≥3 or carries an
explicit exit condition that will delete it if the evidence never materialises.

---

## Evidence and its limits (stated honestly)

The report's headline "35 buggy_code events" is an aggregate. Decomposed against this repo:

| Candidate | Instances | Disposition |
|:---|:---:|:---|
| Shell/encoding corrupting files | **repeated** (report friction category 3) | **T2 — ship** |
| Shared-I/O change verified by subset test only | **1** (2026-07-26, 279 teardown errors) | **T3 — ship with exit condition** |
| Signature change missing call sites | 1 | → IGH-2, one line only |
| First fix fails → re-root-cause | 0 new | **STRUCK** — duplicate of Semantic Loop Detection + `systematic-debugging` |

**Withdrawn during grill:** the argument that hooks deserve priority because they deploy while
rules do not. `deploy.sh:102` `DEPLOYED_ITEMS=(agents rules skills templates commands hooks …)` —
rules deploy too. IGH-1 and IGH-2 have identical reach.

---

## Task Detail

### T1 — Geometry-plugin activation check (verification only, runs FIRST)

`Artifacts/TODO.md` flags that RDT-1's Rhino guards **ship via `/plugin` geometry refresh, not
`deploy.sh`** — "not live in sessions until user reinstalls the geometry plugin." Several Rhino
frictions in the report may be **already-fixed rules that never activated**.

Determine whether the installed geometry plugin carries RDT-1's `-r` rule and the `sc.doc`
pitfall. **No new rules are written until this is answered** — writing a rule that already exists
but is dormant would be pure waste.

Output: a one-table finding. If dormant → the fix is a plugin reinstall, not authoring.

### T2 — Source-redirect guard (`hooks/guard-commands.js`)

Extend the existing deny-hook. **Blast radius must be exact:**

| Blocked | Allowed |
|:---|:---|
| `>` / `>>` / heredoc redirect into tracked source (`.py .ts .js .md .json .yaml .tmdl .csproj`) | anything under `Artifacts/Temp/`, `Artifacts/Evidence/` |
| | `/tmp`, scratch dirs, `/dev/null` |
| | `git commit -m @'…'@` — a heredoc that redirects nowhere |

**Conflict risk (load-bearing):** the EVD rule shipped 2026-07-26 *mandates*
`<command> > Artifacts/Temp/<phase>_<step>_<command>.txt 2>&1`. A guard without the Temp/Evidence
allowlist would fight the evidence protocol it shares a repo with. Allowlist tests are not
optional.

Deny message must name the alternative: *use the Write/Edit tool.*

### T3 — Shared-state test guard (Stop hook)

Grep the turn's diff for global-state mutation — `sys.stdout`, `sys.stderr`, `logging.`,
`TextIOWrapper`, `reconfigure`, `os.environ`. If touched **and** no full-suite run occurred this
turn, nag (feedback only, never block — matching `evidence-gate.js`).

**Honest n=1.** The single instance is this session's own 279-error cascade: a subset run
(`pytest tests/test_backlog_audit.py`) passed while the full suite broke.

**Exit condition — the guardrail reports its own uselessness.** `gate_events.jsonl` +
`gate_telemetry.py` already count per-hook fires and surface them in `/handoff`. If this hook
records **zero fires across 20 sessions**, delete it. Filed to `BACKLOG.md` at ship time with
`Exit: trigger:20-session telemetry review` so the decision is scheduled, not forgotten.

Nag budget: this becomes the **third** Stop hook (`nudge-handoff`, `evidence-gate`, this). Three
is the ceiling — a fourth is a redesign, not an addition.

---

## File Changes

| File | Change |
|:---|:---|
| `hooks/guard-commands.js` | T2 — source-redirect deny with Temp/Evidence allowlist |
| `hooks/guard-shared-state.js` | T3 — **NEW** Stop hook, feedback-only |
| `hooks/enforced-rules.json` | register T3 so `deploy.sh` fails on an unwired hook |
| `tests/test_igh_guards.js` or `tests/test_igh_guards.py` | allowlist + deny + fail-open tests |
| `hooks/README.md` | document both |
| `Artifacts/BACKLOG.md` | T3 exit-condition entry (`OPEN`, `Exit: trigger:20-session review`) |

---

## Dependencies

**Prerequisites:** none. BLR-1 closed and merged (`621e42a`, auditor PASS).
**Enablements:** IGH-2 (rules + auditor blindness). T1's answer may cancel Rhino work entirely.

---

## Hard Rules (Auditor Rejects on Violation)

1. **The redirect guard must not block the EVD evidence protocol.** A test proving
   `cmd > Artifacts/Temp/x.txt` and `> Artifacts/Evidence/x.txt` both pass is mandatory.
2. **All hooks fail open.** Script error exits 0 — the existing invariant in `hooks/README.md`.
   No new hook may block a turn; T3 is feedback-only.
3. **No rule authored before T1 answers.** If a Rhino guard is dormant rather than missing, the
   fix is activation, not authoring.

---

## Success Metrics

- [ ] M1: T1 produces a factual table stating, per RDT-1 rule, whether it is live in the installed
      geometry plugin — with the command and raw output cited
- [ ] M2: `guard-commands.js` blocks redirect-into-source; **allowlist tests prove `Artifacts/Temp/`
      and `Artifacts/Evidence/` redirection still passes** (HR1)
- [ ] M3: `guard-shared-state.js` fires on a diff touching `sys.stdout` with a subset-only test run;
      does **not** fire on a full-suite run; exits 0 on malformed input (fail-open)
- [ ] M4: `enforced-rules.json` updated — `deploy.sh` validation reports **8** enforced hooks wired
- [ ] M5: `python -m pytest tests/ -q` → exit 0
- [ ] M6: `bash scripts/deploy.sh` → 6/6 validation pass
- [ ] M7: BACKLOG carries the T3 exit-condition entry; `backlog_audit.py` still exit 0
- [ ] M8: Auditor PASS on Logic, Style, and all 3 Hard Rules
