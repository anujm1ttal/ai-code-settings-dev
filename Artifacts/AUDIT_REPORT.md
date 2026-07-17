# AUDIT_REPORT.md — GHP-1 Packaging Phase Gate

**Auditor** · Branch `phase-ghp-1-packaging` · Working tree: dirty (pre-commit review — nothing
committed on this branch yet; all changes are in the working tree)
**Scope**: New `grasshopper-plugin-packaging` skill, `rhino-e2e-testing` in-process runner
templates, `python-rhino-grasshopper` pitfalls graduation, registry surface edits
(`skills.overview.md`, `orchestration.md`, `CLAUDE-global.md`, `cheatsheet.md`)

---

## Project Profile (Phase 0)

- **Language**: Markdown (skill/rule authoring) + Python (2 new template scripts: one
  host-side 3.12+, one Rhino-internal ~3.9).
- **Domain**: Rhino/Grasshopper plugin packaging (Yak) + Rhino E2E test-harness tooling.
  Docs/skills-authoring phase — no production application code changed.
- **Frameworks/APIs referenced**: RhinoCommon (`RhinoDoc`, `ObjectEnumeratorSettings`,
  `RhinoApp.RunScript`), `rhinocode` CLI, Yak CLI, pytest.
- **Build/Package**: N/A (docs repo). `pytest` for this repo's own test suite.
- **Test/Lint**: `python -m pytest tests/ -v`, `python -m py_compile` on new `.py` templates,
  `scripts/skill_graph_analyzer.py` / `scripts/model_router.py` as registry checks.

---

## Verdict: **NO-GO** — one Hard Rule (HR2) fails; one registry-integrity gap found

| # | Success Metric | Verdict |
|:---|:---|:---|
| 1 | Registry integrity | **PASS with a finding** (see below — a *mirrored* table outside the officially-listed changed files is now stale) |
| 2 | Tests green | **PASS** |
| 3 | Skill quality (`grasshopper-plugin-packaging`) | **PASS** |
| 4 | CLAUDE-surface standards | **PASS** |

| # | Hard Rule | Verdict |
|:---|:---|:---|
| HR1 | No gBlox/project-specific leakage | **PASS** |
| HR2 | No re-documentation of lanes/directives owned by `testing-strategy.md`/`rhino-e2e-testing` | **FAIL** |
| HR3 | Ambiguities flagged (distribution tag, `# r:` bundling) | **PASS** |
| HR4 | Template sentinel consistency | **PASS** |

---

## Strengths

- **`grasshopper-plugin-packaging/SKILL.md` is well-scoped and honest about its gaps.** It
  leads with the recommended pipeline, stays at 140 lines (under the 150 target), and — unlike
  a lot of skill authoring — explicitly refuses to assert two facts the docs don't settle
  (distribution-tag targeting, `# r:` bundle-vs-runtime-install) rather than papering over them.
  That is exactly the epistemic honesty `standards.md` §Intellectual Honesty asks for.
- **`api-lookups.md`'s new "XML First, Probe Only for Behavior" section is a genuine process
  improvement**, not just a restatement — it names a *specific* fictional-member cascade
  (`BrepFace.Area`/`IsPlane`/`Normal`/`Vertices`, `AreaMassProperties.Volume`, `Brep.Centroid`)
  that a member-probe loop would have hit one at a time, and replaces it with a single grep.
  I independently confirmed the cited absent members are in fact absent from `RhinoCommon.xml`.
- **API Signature Gate evidence is real, not claimed.** I independently grepped
  `RhinoCommon.xml` for every new/suspicious member the coder cites in `pitfalls.md` —
  `ObjectEnumeratorSettings.{NormalObjects,LockedObjects,HiddenObjects}`,
  `ObjectTable.GetObjectList(ObjectEnumeratorSettings)`, `RhinoApp.RunScript(String,Boolean)`,
  `RhinoDoc.Undo` — all exist. `UndoRecordCount`/`DefaultLayerIndex` (added to the deny list)
  are confirmed absent. The `doc.Undo()` "returns True but restores nothing" claim is a
  runtime-observed behavior beyond what the XML doc comment says (`<summary> Undo the last
  action </summary><returns> true on success </returns>`), correctly treated as probe-derived
  rather than XML-derived — consistent with the skill's own new XML-vs-probe methodology.
- **`in_process_bridge_runner.py` / `in_process_suite_runner.py` correctly split by runtime
  dialect**: the bridge (host-side, `python -m pytest` gate) uses 3.12+ syntax (`str | None`);
  the in-Rhino runner carries the `#! python 3` shebang and avoids union syntax, matching the
  Python Runtime Matrix in `coding-style.md`.
- **HR3 flags are precise, not hedge-everything boilerplate.** Both required flags name the
  exact unresolved question and a concrete verification step ("confirm the derived tag on an
  actual `yak build` output", "confirm on a real install before relying on it for offline
  distribution") rather than a generic disclaimer.
- **Registry row edits are surgical.** `CLAUDE-global.md` (+1 line), `orchestration.md`
  (1 cell, `geometry` row), `skills.overview.md` (1 line), `cheatsheet.md` (1 line) — no rule
  content duplicated, no adjacent prose touched.

---

## Success Metric 1 — Registry Integrity

**Consistency across `skills.overview.md` / `orchestration.md` / `CLAUDE-global.md`**: PASS.
All three name `grasshopper-plugin-packaging` identically; the skill's own `## 🔗
Relationships` section cross-references `python-rhino-grasshopper`, `rhino-unit-testing`,
`rhino-e2e-testing` — all three exist under `optional_plugins/geometry/skills/`:

```
optional_plugins/geometry/skills/
  cd-foundations
  grasshopper-plugin-packaging   (new)
  python-rhino-grasshopper
  rhino-e2e-testing
  rhino-unit-testing
```

**Registry check run**: `python scripts/skill_graph_analyzer.py .` — output:
`Total Skills: 32`, `geometry (12 skills)`. Direct reproduction of the script's internal
merge (`load_skills()` + `load_plugin_skills()`) confirms `grasshopper-plugin-packaging` is
one of those 32 (core 15 + plugin 17, plugin count including the new skill).

**Finding (not one of the 8 explicitly-listed changed files, but a real drift this phase
introduces)**: `scripts/skill_graph_analyzer.py` carries its own **inlined mirror** of the
`geometry` project-type default-skills list (its own comment: *"inlined from the retired
manifest_validator; mirror the routing table in `rules/common/orchestration.md`"*):

```python
DEFAULT_SKILLS: dict[str, list[str]] = {
    ...
    "geometry": ["cd-foundations", "python-rhino-grasshopper", "rhino-e2e-testing", "rhino-unit-testing", "python-patterns"],
    ...
}
```

This phase updated `orchestration.md`'s `geometry` row to add `grasshopper-plugin-packaging`
but did **not** update this mirror. Reproduced directly:

```
>>> skills['grasshopper-plugin-packaging'].project_types
[]
```

Net effect: the new skill is loaded and counted, but shows **zero project-type affinity** —
absent from the `geometry (N skills)` affinity list, absent from the singleton list (needs
exactly 1 project type; it has 0), invisible to `/skill-graph`'s clustering. This is exactly
the kind of dangling-registry-reference Success Metric 1 asks me to catch. Not one of HR1–HR4
so I am not failing the gate on it alone, but it is a required fix before this phase is
"done" — filing to `Artifacts/BACKLOG.md` is the auditor's correct channel (I am not adding
a `Artifacts/TODO.md` task per my write-authority limits).

**Fix required**: add `"grasshopper-plugin-packaging"` to the `"geometry"` entry in
`scripts/skill_graph_analyzer.py`'s `DEFAULT_SKILLS` dict (line ~121).

---

## Success Metric 2 — Tests Green

```
$ python -m pytest tests/ -v
...
============================ 131 passed in 26.41s =============================
```
Exit code: 0. All 131 tests pass, no skips/xfails introduced by this phase.

```
$ python -m py_compile optional_plugins/geometry/skills/rhino-e2e-testing/resources/in_process_bridge_runner.py
BRIDGE OK
$ python -m py_compile optional_plugins/geometry/skills/rhino-e2e-testing/resources/in_process_suite_runner.py
SUITE OK
```
Both new template files compile cleanly (host Python 3.14.6, backward-compatible with the
3.12+ syntax the bridge uses; the suite runner avoids `|` unions per the Rhino-internal
dialect rule, so it also compiles clean — appropriately, since `py_compile` only compiles,
it doesn't execute the `str | None` annotation in the bridge file, so this doesn't fully
prove 3.9 compatibility for the suite runner's *runtime* behavior; only real Rhino execution
would, and that lane is out of scope for this docs phase).

## Success Metric 3 — Skill Quality (`grasshopper-plugin-packaging`)

- **Frontmatter**: matches sibling format (`name`, `description`, `argument-hint`,
  `metadata: {version, tags}`) — same shape as `rhino-unit-testing/SKILL.md`. No `model:`
  override, correctly so (per `model-routing.md`, only `python-rhino-grasshopper`,
  `typescript-mcp`, `systematic-debugging` carry overrides — `rhino-unit-testing` doesn't
  either).
- **Length**: 140 lines (`wc -l`), under the 150-line target.
- **Packaging checklist**: present, `## ✅ Packaging Checklist`, 11 items.
- **Leads with recommended pipeline**: first content section is `## 🚀 Recommended Pipeline
  (Lead With This)`.
- **References vs. restates**: "See `python-rhino-grasshopper` for RhinoCommon authoring
  patterns — not restated here"; "Full `# venv:`/`# r:`/`# env:` semantics ... are owned by
  `rhino-e2e-testing` §*Bringing packages into the in-process script* — not restated here."
  I confirmed that referenced section heading actually exists in
  `rhino-e2e-testing/SKILL.md:129` — not a dangling cross-reference.

PASS.

## Success Metric 4 — CLAUDE-surface Standards

`CLAUDE-global.md` is 153 lines (target ≤250, hard cap 400) — the +1 row is the only change,
no duplication of rule content. `rules/common/orchestration.md` is 347 lines — the diff is a
single-cell edit to the `geometry` row (not a `CLAUDE.md`-tier file, so `claude-md-standards.md`
size caps don't directly apply, but the edit is surgical regardless). `skills.overview.md` and
`cheatsheet.md` each get a single-line addition. No adjacent prose touched, no rule content
copy-pasted into any of the four files. PASS.

---

## Hard Rule HR1 — No gBlox/Project-Specific Leakage

The task-suggested command (`git diff main -- optional_plugins/ | grep -in "gblox\|
MCP_LANE_A_TEST\|SimpleBuilding"`) **only covers tracked-file diffs** — it silently misses the
three new *untracked* paths (`grasshopper-plugin-packaging/` entirely, plus the two new
`resources/*.py` files), since `git diff` does not show untracked content. I ran it as
specified (no matches, exit 1) and then extended the check directly against the untracked
files and the full `optional_plugins/geometry/` tree plus all four registry-surface files:

```
$ git diff main -- optional_plugins/ | grep -in "gblox\|MCP_LANE_A_TEST\|SimpleBuilding"
(no output, exit 1)

$ grep -rin "gblox\|MCP_LANE_A_TEST\|SimpleBuilding" optional_plugins/geometry/ \
    CLAUDE-global.md rules/common/orchestration.md cheatsheet.md skills/skills.overview.md
(no output, exit 1)
```

Zero matches across the full changed surface, tracked and untracked. **PASS.**

## Hard Rule HR2 — No Re-documentation of Lanes/Directives Owned Elsewhere

**FAIL.** Three facts are freshly duplicated across files in this same phase instead of being
referenced once from the owning location (`rhino-e2e-testing`):

**1. `rhinocode script` exit-0-before-done timing** — already owned by
`rhino-e2e-testing/SKILL.md` **before this phase** (pre-existing line, unchanged by this diff):

> `rhinocode script` returns **exit 0 before the script finishes**. The script must flush
> incrementally to a file and write a terminal **sentinel line**; the caller polls that file
> for the sentinel before reading results. Always pass an **absolute** script path — a
> relative path silently runs nothing.

This phase adds a near-verbatim restatement as a **new row in `pitfalls.md`**, with no
cross-reference to `rhino-e2e-testing`:

> `rhinocode ... script` exit-code timing | Returns exit `0` **before** the script finishes;
> a report read immediately is truncated and looks exactly like a mid-script abort | Probes
> must flush output incrementally and write a terminal sentinel line; the caller waits for
> that line before reading the report

...and a second new `pitfalls.md` row restating the companion fact:

> `rhinocode ... script <relative-path>` | Silently runs nothing and exits `0` | Always pass
> an **absolute** script path

...and the *same* fact is stated a third and fourth time in this phase's own new content: the
new "Lane A in-process runner" section of `rhino-e2e-testing/SKILL.md` ("**Exit-0-before-done**:
`rhinocode script` returns 0 before the script finishes...") and both new template docstrings
(`in_process_bridge_runner.py`: *"Why this exists (the exit-0-before-done trap)"*;
`in_process_suite_runner.py`: *"Why exit-0-before-done matters here too"*).

**2. `rhinoinside.load()` defaulting to Rhino 7** — added to **two files in the same diff**
simultaneously, not one referencing the other. `rhino-e2e-testing/SKILL.md`'s edited
Troubleshooting section:

> A bare `rhinoinside.load()` silently defaults to **Rhino 7** (signature:
> `load(rhino_dir_or_major_version = 7, ...)`) with no warning — Rhino 8-only APIs (e.g.
> `ModelObject`) then fail in a way that masquerades as test rot. Always `rhinoinside.load(8)`
> explicitly; when Lane A behaves strangely on a multi-Rhino machine, verify
> `Rhino.RhinoApp.Version.Major` **before** triaging test failures.

`pitfalls.md`'s new row, same PR:

> Bare `rhinoinside.load()` | Silently loads Rhino 7 on multi-version machines; Rhino 8-only
> APIs fail, masquerading as test rot | Always `rhinoinside.load(8)`; verify
> `Rhino.RhinoApp.Version.Major` **before** triaging Lane A failures

Both `rhinoinside.load()` and `rhinocode script` are Lane A / `rhino-e2e-testing`-owned tooling
by definition — not general RhinoCommon-authoring pitfalls. `pitfalls.md` (owned by
`python-rhino-grasshopper`) is the wrong home for the full restatement; the skill's own
established pattern elsewhere in this same diff (e.g. `grasshopper-plugin-packaging`'s "not
restated here, see X") is the correct model and was not applied here.

**Fix required** (either is acceptable, pick one):
- Remove the two/three duplicated `pitfalls.md` rows entirely and replace with a single
  one-line pointer, e.g. `Lane A / rhinocode gotchas (exit timing, rhinoinside version) →
  rhino-e2e-testing`; or
- Keep a one-clause pointer in `pitfalls.md` ("see `rhino-e2e-testing` Troubleshooting") and
  delete the restated detail column, keeping the full explanation solely in
  `rhino-e2e-testing`.
- Either way, drop the redundant "4 gotchas" list items in the new "Lane A in-process runner"
  section down to a bare pointer at the docstrings, since the docstrings already state (and
  the skill text itself says) *"don't re-derive"* — the list re-derives what it just said not
  to re-derive.

This is not a nitpick: five separate locations now assert the exact same operational fact.
`orchestration.md` §Artifact Separation and `claude-md-standards.md` §5 (Rule-echo) both treat
this pattern as a maintenance-debt generator — a future correction to the exit-timing behavior
requires remembering to edit five files, and drift between them is exactly how stale
guidance survives an audit undetected next time.

## Hard Rule HR3 — Ambiguities Flagged

**PASS.** Both required claims are explicitly flagged as unverified, not stated as settled
fact. Quoted directly from `grasshopper-plugin-packaging/SKILL.md`:

Distribution-tag version-targeting (line 70):
> **FLAG — verify against a live Rhino 8 build**: targeting a specific Rhino version is
> controlled via the build target / referenced RhinoCommon assembly, not a YAML field. Not
> settled from docs alone — confirm the derived tag on an actual `yak build` output before
> shipping.

`# r:` dependency bundle-vs-user-runtime (line 89):
> **FLAG — verify against a live Rhino 8 build**: McNeel docs do NOT settle whether `# r:`
> deps bundle into the `.yak` at build time or pip-install on the **end user's** machine at
> first run. Evidence favors runtime install — first run "takes time and disables the
> editor," implying a live install step — meaning end users would need internet access. Do
> not treat this as settled; confirm on a real install before relying on it for offline
> distribution.

The companion `references/yak-cli.md` repeats the distribution-tag flag consistently
("**Unresolved from docs (flag, do not assume)**...") rather than contradicting it.

## Hard Rule HR4 — Template Sentinel Consistency

**PASS.** Identical string, quoted from both files:

`in_process_bridge_runner.py:44`:
```python
SENTINEL = "[inprocess] complete rc="   # must match the runner's SENTINEL constant exactly
```

`in_process_suite_runner.py:56`:
```python
SENTINEL = "[inprocess] complete rc="   # must match the bridge's SENTINEL constant exactly
```

Byte-identical. The bridge polls for `line.startswith(sentinel)`; the runner writes
`SENTINEL + str(int(rc))` on every exit path (success, pytest-import failure, Rhino-import
failure, pytest crash, and the outer fatal handler) — confirmed all five `emit(SENTINEL + ...)`
call sites in `in_process_suite_runner.py` use the same `SENTINEL` constant, not a hardcoded
copy.

---

## Spot-check (INFO) — `pitfalls.md` RhinoCommon idioms

Independently grepped `optional_plugins/geometry/skills/python-rhino-grasshopper/resources/RhinoCommon.xml`:

- `Rhino.DocObjects.ObjectEnumeratorSettings.NormalObjects` / `.LockedObjects` /
  `.HiddenObjects` — exist (properties, confirmed at their `<member>` entries).
- `Rhino.DocObjects.Tables.ObjectTable.GetObjectList(Rhino.DocObjects.ObjectEnumeratorSettings)`
  — exists.
- `Rhino.RhinoApp.RunScript(System.String,System.Boolean)` — exists, matches the
  `RhinoApp.RunScript("_Undo", False)` idiom cited in `pitfalls.md`.
- `Rhino.RhinoDoc.Undo` — exists; XML summary (`"Undo the last action" / returns "true on
  success"`) does not itself state the no-op behavior claimed in `pitfalls.md` — that claim is
  correctly framed as a runtime-observed pitfall, not an XML-sourced fact, consistent with the
  skill's new XML-vs-probe methodology.
- `UndoRecordCount`, `DefaultLayerIndex` (added to the hallucination deny list) — confirmed
  **absent** from `RhinoCommon.xml`.

No API-signature concerns. This satisfies the API Signature Gate for this phase's `pitfalls.md`
additions.

---

## Overall Verdict: NO-GO

**Blocking**: HR2 (re-documentation) — 2–3 duplicated rows in `pitfalls.md` plus a redundant
gotchas list in `rhino-e2e-testing/SKILL.md`'s new section, restating facts already owned by
`rhino-e2e-testing`.

**Required before re-audit**:
1. Remove/consolidate the duplicated `pitfalls.md` rows (`rhinoinside.load()` Rhino-7 default,
   `rhinocode` relative-path, `rhinocode` exit-timing) into a single pointer to
   `rhino-e2e-testing`, OR keep the pointer + delete the restated detail column.
2. Trim the "4 load-bearing gotchas" list in `rhino-e2e-testing/SKILL.md`'s new "Lane A
   in-process runner" section so it doesn't re-derive content the section's own text says not
   to re-derive — a one-line pointer to the docstrings is sufficient given the docstrings are
   already the stated source of truth.
3. Update `scripts/skill_graph_analyzer.py`'s inlined `DEFAULT_SKILLS["geometry"]` mirror to
   include `grasshopper-plugin-packaging`, so `/skill-graph` reflects the same routing
   `orchestration.md` now states (filed as a required fix, not gating HR1–HR4, but blocking
   "done" under Success Metric 1).

Not blocking, but should accompany the fix: none of HR1, HR3, HR4, or Success Metrics 2–4 need
rework. Tests are green (131/131, exit 0), no secrets/project leakage, both ambiguities
correctly flagged, template sentinels consistent.

No files were edited and no `Artifacts/TODO.md` entries were marked by this audit, per
auditor write-authority limits. Findings above are for the strategist/coder to action; the
registry-mirror gap (Metric 1) belongs in `Artifacts/BACKLOG.md` if not fixed in the same pass.
