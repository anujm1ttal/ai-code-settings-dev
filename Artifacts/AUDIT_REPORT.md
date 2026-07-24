# AUDIT_REPORT — RDT-1 Gate (T6)

**Auditor run:** 2026-07-24 (re-audited same day after HR1 fix) · **Branch:** `phase-rdt-1-rhinocode-doc-guard` (working tree, nothing committed)
**Scope:** RDT-1 T1-T5 (Lane A-live harness hardening + rule codification), gating T6 (deploy — deferred to user, NOT run by this audit).
**Verdict: GO** — HR1 fix to `SKILL.md` re-verified clean by direct read. T1-T5 all pass. T6 (deploy) remains user-held, not run by this audit.

---

## Re-audit addendum (2026-07-24, HR1 fix)

Orchestrator applied a 4-line fix to `optional_plugins/geometry/skills/rhino-e2e-testing/SKILL.md`
directly. Re-verified by reading the live file (not the orchestrator's summary):

- `SKILL.md:123-124` — Subcommands table `script`/`command` rows now read `rhinocode -r <id> script <path.py>` / `rhinocode -r <id> command "..."` — both `-r`-qualified.
- `SKILL.md:122,125` — `list` and `project build` rows explicitly note they take no `-r` (correct — neither targets a running instance's document).
- `SKILL.md:127` — old "Target a specific instance ... when multiple are open" (the reintroduced-ambiguity framing) is gone; replaced with "**Always pass `-r <pipeId>` on `script`/`command`, never bare**" + a restated "no `-i` flag" line, consistent with Key Rule 3 (line 181).
- `SKILL.md:156` (Evidence Protocol) — now `rhinocode -r <id> script /abs/path/probes/check_plugin_state.py` — gained `-r <id>` **and** the path is now absolute, fixing a second latent defect (the file's own async-gotcha note at line 146 already states a relative path "silently runs nothing" — the example previously violated its own adjacent warning).
- Grep sweep (`rhinocode `) across the full file: the only remaining bare `rhinocode script` mentions are prose (lines 131, 146, 164, 168, 180) describing the subcommand's behavior generically, with no path/flags following — not copyable invocations. Confirmed out of HR1 scope, agreeing with the orchestrator's read.

HR1 is now **PASS**. No other findings changed — HR2, HR3, all success metrics, and the pytest
evidence below stand from the original pass (no code changed, re-run not required). T4 marked `[x]`.

---

## Project Profile (Phase 0)

- **Language/Domain:** Python (host CPython, repo's own venv) + Python ~3.9 embedded-Rhino dialect (`in_process_suite_runner.py`) + Markdown skill docs. `geometry` domain (settings-repo hardening of the `rhino-e2e-testing` Lane A-live harness) — **no new Rhino.Geometry object creation**, this is process/tooling code (subprocess orchestration, JSON parsing, env-var guards), not geometry math.
- **Frameworks:** `subprocess`, `json`, stdlib only (host side); `Rhino.RhinoDoc` (in-Rhino side, ~3.9 embedded interpreter).
- **Build/Test:** `python -m pytest tests/ -q` (Lane B, pure — per plan's own Test Lane section; no live Rhino instance required for this gate).
- **Lint:** N/A formal linter; dialect compliance (no `|` unions, no `typing` imports, no f-strings) checked by direct read for the ~3.9 file.

Because no `Rhino.Geometry` objects (Brep/Mesh/Curve) are created or mutated by this change, the
**E2E Coverage Gate** (closure/manifoldness/tolerance assertions) is **not applicable** — this is
harness/guard code, not geometry-producing code. The **API Signature Gate** still applies to the
two RhinoCommon members referenced in the new doc-hint guard (`RhinoDoc.ActiveDoc`, `RhinoDoc.Name`)
— see Hard Rule / Gate findings below.

---

## Strengths

- **`discover_rhino_instances()` / `resolve_instance()` are exactly the design in the plan**, not an
  approximation: JSON parse → filter `processName == "Rhino"` → precedence `RHINO_INSTANCE_ID` override
  → 0/1/>1 branching, with the >1 branch building a diagnostic table naming every `pipeId` +
  `activeDoc.title` before raising. Read directly in
  `optional_plugins/geometry/skills/rhino-e2e-testing/resources/in_process_bridge_runner.py:44-85`.
- **`_INSTANCE_ID_RE` is fully gone from every shipped resource.** `grep -rn "_INSTANCE_ID_RE|discover_instance_id"` across the repo returns matches only in `Artifacts/Plans/RDT-1-Plan.md` and `RDT-1-TODO.md` (prose describing the removal) — zero in `.py`/`SKILL.md`/`pitfalls.md`.
- **Test coverage genuinely proves the four resolution paths**, not a pass-through: `tests/test_rdt_instance_resolution.py` mocks `subprocess.run` per-test and asserts (a) `compute.geometry` filtered out of `discover_rhino_instances()`, (b) single-Rhino → pipeId, (c) two-Rhino → `AssertionError` whose message contains **both** `activeDoc.title` strings (asserted individually, not just "raises"), (d) `RHINO_INSTANCE_ID` set → discovery never called (a `_fail` stub that itself raises if `subprocess.run` is invoked — a real negative-proof, not a spy that's merely unasserted). All 5 pass fresh (see Evidence).
- **Doc-hint guard is correctly positioned before any real work**: `_run()` in `in_process_suite_runner.py` reads `RHINO_DOC_HINT`/`RHINO_DOC_READONLY`, imports `Rhino`, reads `ActiveDoc.Name`, and branches to `SENTINEL + "94"` + `return` on mismatch — all **before** the `sys.modules` purge (line 92) and `import pytest` (line 101). A mismatch genuinely runs nothing downstream.
- **Both RhinoCommon members the guard depends on are real**, confirmed by this audit directly against `optional_plugins/geometry/skills/python-rhino-grasshopper/resources/RhinoCommon.xml`: `P:Rhino.RhinoDoc.ActiveDoc` (line 123535) and `P:Rhino.RhinoDoc.Name` (line 123550, "Returns the name of the currently loaded Rhino document").
- **~3.9 dialect is clean in the guard's own code**: no `|` union hints, no `typing` imports, no f-strings (uses `%`-formatting consistent with the rest of the file); `grep` for those patterns in `in_process_suite_runner.py` returns zero matches.
- **`pitfalls.md` row is correctly scoped**: names the defect (bare `rhinocode`, ambiguous/first-match resolution), the concrete failure mode (wrong document or a `compute.geometry` pipe), the fix (filter + always `-r` + `RHINO_DOC_HINT`), and explicitly attributes ownership to `rhino-e2e-testing` — matching T5's success criterion.
- **No phantom `-i` prohibition** anywhere in the new `SKILL.md` text — the only `-i` mention is the factual "There is no `-i` flag; the only selector is `-r, --rhino <ID>`" (line 180), exactly as required.
- **No pinned PID/instance-id literal** in any template or doc example (`grep` for `rhinocode_remotepipe_\d+|-r \d{4,}|--rhino \d{4,}` across the skill directory: zero hits outside the exempt test-fixture data in `tests/test_rdt_instance_resolution.py`).

---

## Hard Rule Findings

### HR1 — PASS (fixed 2026-07-24, re-audited clean — see addendum above): stale bare-`rhinocode` examples corrected

Plan Hard Rule 1 is unconditional: *"No `rhinocode` invocation in any shipped resource omits `-r`."*
The coder added a correct new Key Rule 3 ("**Verify the target, always `-r`, never bare**" —
`SKILL.md:180`) but did **not** touch the pre-existing content earlier in the same file, which now
directly contradicts it:

- `SKILL.md:122` — `` `rhinocode script <path.py>` `` (Subcommands table, no `-r`)
- `SKILL.md:123` — `` `rhinocode command "_circle 0 0 0 20"` `` (Subcommands table, no `-r`)
- `SKILL.md:127` — *"Target a specific instance with `--rhino <id>` **when multiple are open**."* — this literally reintroduces the rejected "bare is fine unless ambiguous" framing the plan's premise-corrections section explicitly ruled out (Plan.md line 20-21: first-match resolution is the defect regardless of instance count, because a `compute.geometry` pipe can appear even with exactly one Rhino open).
- `SKILL.md:154-155` — the "Evidence Protocol" bash block: `rhinocode list --json > ...` (fine, no `-r` needed for `list`) then `rhinocode script probes/check_plugin_state.py > ...` — **no `-r`**, presented as the canonical copy-paste evidence-capture pattern.

This is not a cosmetic gap — it is the exact failure mode RDT-1 exists to close, now modeled as
the "correct" way to invoke `rhinocode` four lines above/below the rule that says never to do that.
An agent skimming the Subcommands table or Evidence Protocol (both appear before the Key Rules
section in reading order) will copy the bare form.

**Required fix before `[x]`:** add `-r <pipeId>` (or `-r $(...)`/placeholder consistent with the
new Key Rule) to lines 122, 123, 127, 155, and either remove line 127's "when multiple are open"
qualifier or rewrite it to match "always `-r`, never bare" verbatim so the file does not contradict
itself.

### HR2 — PASS: instance resolution filters `processName == "Rhino"`, zero regex-based resolution survives

Verified directly in code (`in_process_bridge_runner.py:55`) and by grep (`_INSTANCE_ID_RE`/
`discover_instance_id` → 0 hits in any `.py`/`SKILL.md`/`pitfalls.md`).

### HR3 — PASS: no pinned PID/instance-id literal in templates or docs

Verified by grep across the skill directory; only occurrences are synthetic pytest fixture data in
`tests/test_rdt_instance_resolution.py`, which is explicitly exempted by the audit scope.

---

## Success Metric Findings

| Metric | Status | Evidence |
|:---|:---|:---|
| `discover_rhino_instances()` filters `processName=="Rhino"` | PASS | Code read + `test_discover_rhino_instances_filters_compute_geometry` PASSED |
| `resolve_instance()`: >1 → `AssertionError` naming both titles; 1 → pipeId; override skips discovery | PASS | All 4 paths covered by dedicated tests, all PASSED (see Evidence) |
| Suite runner emits `SENTINEL+"94"`, runs no pytest on mismatch; warn-only when unset/`READONLY=1` | PASS | Code read: guard at `in_process_suite_runner.py:67-90`, strictly before purge (line 92-98) and `import pytest` (line 101) |
| Dialect: guard code is ~3.9-safe | PASS | No `|` unions/`typing` imports/f-strings; `%`-formatting throughout |
| `RhinoDoc.ActiveDoc`/`.Name` are real members | PASS | Confirmed against shipped `RhinoCommon.xml` (lines 123535, 123550) |
| `python -m pytest tests/ -q` exit 0 | PASS | Re-run by auditor, see Evidence below |
| SKILL.md/pitfalls.md codify "always `-r`, never bare", no phantom `-i` ban, pitfalls row owned by rhino-e2e-testing | **PASS** (post-fix) | HR1 addendum above — all examples now `-r`-qualified, no self-contradiction |

---

## API Signature Gate

Coder evidence of searching `RhinoCommon.xml` before using `RhinoDoc.ActiveDoc`/`.Name`: **not found**
in `Artifacts/BACKLOG.md`, `Artifacts/Temp/`, or commit history (working tree — nothing committed
yet on this branch). This audit performed the lookup directly and confirmed both members exist
(see Strengths). Flagged as a **MEDIUM** process finding, not a rejection basis, because the actual
signatures are correct — but the coder should not have relied on tribal knowledge of a
two-member, low-ambiguity surface without recording the lookup; do this going forward per the gate.

## E2E Coverage Gate

Not applicable — no `Rhino.Geometry` (Brep/Mesh/Curve) objects are created or mutated by this
change. This is subprocess/env-var harness code. No geometric invariants to assert.

## Visual QA Subagent

Not applicable — no UI/layout/visual deliverable in this change.

---

## Evidence — pytest gate (re-run by auditor, not trusted from coder claim)

Command:
```
python -m pytest tests/ -q
```
Tail:
```
........................................................................ [ 52%]
................................................................         [100%]
136 passed in 23.40s
```
Exit code: **0**

Isolated re-run of the new RDT-1 test file for traceability:
```
python -m pytest tests/test_rdt_instance_resolution.py -v
```
```
tests/test_rdt_instance_resolution.py::test_discover_rhino_instances_filters_compute_geometry PASSED [ 20%]
tests/test_rdt_instance_resolution.py::test_resolve_instance_single_rhino_returns_pipe_id PASSED [ 40%]
tests/test_rdt_instance_resolution.py::test_resolve_instance_multiple_rhino_raises_naming_both_docs PASSED [ 60%]
tests/test_rdt_instance_resolution.py::test_resolve_instance_honors_env_override_without_discovery PASSED [ 80%]
tests/test_rdt_instance_resolution.py::test_resolve_instance_no_rhino_instances_raises PASSED [100%]
5 passed in 0.02s
```

---

## Other Findings

- **INFO**: `Artifacts/GLOBAL_INBOX.md` shows as modified in `git status` but is unrelated to RDT-1
  (133 insertions, no reference to RDT/rhinocode/doc-hint) — likely carried over from a prior
  session on this working tree. Out of scope for this gate; flagged so it isn't silently swept into
  an RDT-1 commit.
- **LOW**: `SKILL.md:127`'s "Target a specific instance with `--rhino <id>` when multiple are open"
  uses the long-form `--rhino` flag where the rest of the new text uses short-form `-r` — cosmetic
  inconsistency, subsumed by the HR1 fix (this line needs rewriting anyway).

---

## TODO Status

Per `orchestration.md` TODO Authority, auditor may only mark `[x]`; never add/remove tasks. Marked
in `Artifacts/Plans/RDT-1-TODO.md`:

- [x] T1 — JSON discovery + fail-loud resolution — PASS (HR2 clean, all resolution-path tests green)
- [x] T2 — doc-hint guard in `in_process_suite_runner.py` — PASS (correct position, correct sentinel, 3.9-safe)
- [x] T3 — Lane B tests for T1 — PASS (5/5 green, genuinely proves all 4 branches, re-run fresh by auditor)
- [x] T4 — `SKILL.md` Key Rule — PASS (re-audited post-fix; HR1 addendum above)
- [x] T5 — `pitfalls.md` row — PASS
- [ ] T6 — deploy gate — **left unchecked**, deferred to user per task instructions (no deploy/merge/push performed by this audit)

---

## Verdict

**GO.** T1-T5 all verified clean by direct artifact inspection (code reads, grep sweeps, fresh
pytest run, and — for the HR1 fix — a full re-read of the corrected `SKILL.md` ranges plus a
repo-wide `rhinocode ` grep to confirm no remaining bare copyable invocation exists). T6 (deploy)
remains user-held per task instructions — this audit does not run `bash scripts/deploy.sh`, does
not merge, and does not push.
