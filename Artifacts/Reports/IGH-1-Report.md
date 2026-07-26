# IGH-1 — Mechanical Guards — Phase Report

**Verdict: PASS** (all 8 metrics met, all 3 Hard Rules held)
**Date:** 2026-07-26 · **Branch:** `phase-igh-1-mechanical-guards` · **Plan:** `Artifacts/Plans/IGH-1-Plan.md`
**Evidence:** `Artifacts/Evidence/IGH-1/` (12 files, all cited below by name)

---

## 1. Independence caveat (stated first, as in BLR-1)

**This is a self-audit and that is the weakest form of verification.** The same session that
wrote T2–T4 also ran this gate. The mitigation applied — the same one BLR-1 used — is that no
claim is carried forward from the implementation narrative: every metric below was re-derived by
re-running the command or re-reading the raw artifact, and the guard was probed **adversarially
against the deployed copy** rather than reviewed as source.

That mitigation demonstrably worked: the adversarial pass found a real bypass in the
implementer's own work (§4). An independent auditor would still be preferable.

---

## 2. Success Metrics

| # | Metric | Result | Evidence |
|:--|:---|:---|:---|
| M1 | T1 activation table, per-rule live/dormant, command + raw output cited | **MET** — 3 installs × 4 markers, with control | `igh1_t1_plugin_activation.txt`, `igh1_t1_file_presence.txt` |
| M2 | Redirect-into-source blocked; **Temp/ + Evidence/ allowlist tests pass (HR1)** | **MET** — 23/23 adversarial cases correct vs deployed hook | `igh1_t5_adversarial.txt` |
| M3 | Shared-state hook fires on subset-only run, silent on full suite, exits 0 on malformed input | **MET** — 52 tests in `test_igh_guards.py` | `igh1_t3_tests.txt` |
| M4 | `deploy.sh` reports **8** enforced hooks wired | **MET** — "OK: all 8 enforced hook(s) present and wired" | `igh1_t4_wiring.txt`, `igh1_m6_deploy.txt` |
| M5 | `python -m pytest tests/ -q` exit 0 | **MET** — **216 passed, exit 0** | `igh1_m5_pytest_full.txt` |
| M6 | `bash scripts/deploy.sh` 6/6 | **MET** — exit 0, DEPLOYMENT COMPLETE | `igh1_m6_deploy.txt` |
| M7 | BACKLOG carries T3 exit-condition entry; `backlog_audit.py` exit 0 | **MET** — `igh1_shared-state-hook_1` filed OPEN; audit clean, exit 0 | `igh1_t4_registry.txt` |
| M8 | Auditor PASS on Logic, Style, all 3 Hard Rules | **MET** — this report | §3, §4 |

---

## 3. Hard Rules

Evidence: `igh1_t5_hardrules.txt` (mechanical checks, re-run at gate time).

**HR1 — The redirect guard must not block the EVD evidence protocol. HELD.**
Allowlist tests are present and named, not incidental: `test_allowlisted_and_nonsource_redirects_pass`,
`test_allowlist_cannot_be_escaped_by_traversal`, `test_powershell_write_cmdlet_into_temp_passes`.
Live-fire against the **deployed** hook: `pytest … > Artifacts/Temp/x.txt 2>&1` ALLOW,
`… > Artifacts/Evidence/IGH-1/d.txt 2>&1` ALLOW, `python gen.py > Artifacts/Temp/probe.py` ALLOW
(a source *extension* inside Temp/ is still allowed — the protocol's own escape hatch survives).

**HR2 — All hooks fail open; no new hook blocks a turn. HELD.**
`grep -cE "permissionDecision|\"decision\"|process.exit(2)"` on `guard-shared-state.js` → **0**.
The only exit code appearing in either hook is `process.exit(0)`. Malformed stdin against the
deployed hook → empty stdout, exit 0.

**HR3 — No rule authored before T1 answered. HELD.**
Files changed this phase, counted mechanically: **0** under `rules/ skills/ agents/ commands/`.
The phase touched only `hooks/`, `tests/`, and `Artifacts/`. T1 ran first and its answer
(§5) cancelled the Rhino authoring IGH-2 had queued.

---

## 4. Defect found and fixed at this gate

**The T5 adversarial probe found a real bypass in T2, introduced by the implementer.**

`echo x > Artifacts/Temp/../../scripts/thing.py` was **ALLOWED**. The allowlist substring-matched
`Artifacts/Temp/` anywhere in the path, so a `..` segment carried an allowlisted prefix straight
back out into the source tree.

- **Fix:** a traversing target is never allowlisted — `isProtectedTarget` now denies any target
  containing a `..` path segment before the allowlist is consulted.
- **Regression test:** `test_allowlist_cannot_be_escaped_by_traversal` (3 cases, incl. Windows
  separators), tagged with the discovery date.
- **Re-verified:** full suite 213 → **216 passed exit 0**; redeployed; adversarial probe re-run
  against the deployed copy → **23/23, 0 deviations**.

**Process note.** The first probe attempt was itself **blocked by the guard under audit**,
because the probe script contained `> scripts/thing.py` as literal test data. This is the
documented raw-string limitation firing within minutes of deploy, against its own author. The
probe was rewritten to assemble cases from fragments (`Artifacts/Evidence/IGH-1/igh1_t5_probe.py`). The
incident is genuine evidence about the guard's usability cost, not a curiosity — recorded in §6.

---

## 5. T1 finding — the phase's most consequential result

**RDT-1's Rhino guards are DORMANT in every installed geometry plugin. The gap is distribution,
not prose.**

| Install | SHA / ver | RDT-1 `-r` | doc-hint | no-`-i` | GHP-2 `sc.doc` |
|:---|:---|:---:|:---:|:---:|:---:|
| parametric-stadium-bowl-system | `3e2e20b1` (07-06) | DORMANT | DORMANT | DORMANT | DORMANT |
| my_mcp_rhino | `1c00fb3a` (07-06) | DORMANT | DORMANT | DORMANT | DORMANT |
| garden-planner-app | `1.1.0` / `e135b6d8` (07-20) | DORMANT | DORMANT | DORMANT | **LIVE** |
| repo source (control) | working tree | LIVE | LIVE | LIVE | LIVE |

**The oracle discriminates.** `e135b6d8` is the direct parent of RDT-1's merge `2b9f88d`, and it
correctly reports GHP-2 (2026-07-17) LIVE while RDT-1 (2026-07-24) is DORMANT. A probe returning
DORMANT for everything would be indistinguishable from a broken grep; this one does not.

**Dormant, not absent.** `rhino-e2e-testing/SKILL.md` exists in all three installs. The two
07-06 installs still carry the *pre-RDT-1* Key Rule 3 — "Run `rhinocode list` before
`script`/`command`" — the exact weaker rule RDT-1 replaced. `-r <pipeId>`: **0** occurrences in
all installs, **2** in repo source.

**Consequences:** (1) IGH-2 must not re-author these rules — HR3's premise was correct.
(2) `deploy.sh` cannot fix this; plugin installs pin a SHA per consuming project and never
auto-refresh. (3) **User action required:** `/plugin` reinstall of `geometry` in each of the
three projects.

---

## 6. Residual risks and honest limits

1. **The guard is a speed bump, not a sandbox.** Verified-allowed write paths that bypass it
   entirely: `tee`, `cp`, `sed -i`, `python -c "open(...)"`. It stops careless redirects; it
   does not stop a determined write. Claiming otherwise would be false.
2. **Raw-string matching causes real false positives.** A source-file redirect quoted *inside* a
   string literal denies. This bit the audit itself. Documented in `hooks/README.md`; the escape
   hatch is the Write tool, which is what the deny message names.
3. **T3 remains honestly n=1** and is the third Stop hook. It ships with a mechanical exit
   condition, not an argument: BACKLOG `igh1_shared-state-hook_1`, checkable via
   `python scripts/gate_telemetry.py --since 2026-07-26`. Zero fires across ~20 sessions → delete.
4. **The T3 hook likely does not fire until a session restart** — the hook list is read from
   `settings.json` at session start. Absence of nags this session is not evidence it works.
5. **`~/.claude/settings.json` wiring is unversioned.** `deploy.sh` deliberately never overwrites
   it; the versioned copy is `hooks/settings-template.json`. They are in sync now, but a future
   template change needs the live file edited too — the first deploy attempt failed for exactly
   this reason. Same hazard class as BACKLOG `rdt_graduate-source-vs-deployed_1`.

---

## 7. Finding raised for decision (NOT filed as backlog)

`BACKLOG.md` stands at **246 lines / 250 threshold, 12 entries, 0 RESOLVED**. BLR-1's rotation
moves only RESOLVED entries and OPEN entries never rotate — so the trigger will fire within about
one entry and be structurally unable to move anything. Dogfooding found a genuine gap in the
mechanism BLR-1 shipped one session ago.

Filing this as a BACKLOG entry would add ~30 lines to the file that is overflowing, so it is
raised here for a decision instead. Options: raise the line threshold (entries, at 12/20, are
nowhere near their cap and are arguably the better signal); allow rotation of OPEN entries above
some age; or split reference-shaped entries out to their own artifacts per the existing eviction
clause.

---

## 8. Disposition

T1 `[x]`, T2–T4 verified and eligible for `[x]`. **Not yet done:** commit on
`phase-igh-1-mechanical-guards`; merge to `main`; the 3 unpushed commits on `main`. IGH-2 may
proceed **minus** all Rhino rule authoring, and its auditor-blindness clause still requires
live-fire dispatch evidence before merge.
