# AUDIT_REPORT.md — GHP-2 GHPython Component Contract Phase Gate

**Auditor** · Branch `phase-ghp-2-ghpython-contract` · Working tree: dirty (pre-commit review —
nothing committed on this branch yet; all changes are in the working tree)
**Scope**: New `references/ghpython-component.md` reference file, one `SKILL.md` pointer row,
2 new `pitfalls.md` rows, API-gate fix in `api-lookups.md` (Grasshopper.xml worked example +
`.BoundingBox`/`ClippingBox` annotation) — all in the `python-rhino-grasshopper` skill.

---

## Project Profile (Phase 0)

- **Language**: Markdown (skill/reference authoring). No production application code changed.
- **Domain**: Rhino 8 / Grasshopper — GHPython script-component runtime contract
  (`ghenv.Component`, data trees, `sc.sticky`, custom viewport draw, IronPython→CPython3 port
  notes).
- **Frameworks/APIs referenced**: `Grasshopper.Kernel.GH_ScriptInstance`, `IGH_Component`,
  `IGH_ActiveObject`, `Grasshopper.DataTree\`1`, `Grasshopper.Kernel.Data.GH_Path`,
  `Rhino.Display.DisplayPipeline`, `ghpythonlib.treehelpers`, `ghpythonlib.components`,
  `scriptcontext.sticky`.
- **Build/Package**: N/A (docs repo).
- **Test/Lint**: `python -m pytest tests/ -v` (this repo's own registry/hook/router test suite —
  doc-only changes are not expected to move it).

---

## Verdict: **GO**

| # | Success Metric | Verdict |
|:---|:---|:---|
| 1 | Tests green | **PASS** — `131 passed`, exit code 0 (fresh run, see §Evidence) |
| 2 | Reference quality (`ghpython-component.md`) | **PASS** |
| 3 | API-gate fix (`api-lookups.md`) | **PASS** |

| # | Hard Rule | Verdict |
|:---|:---|:---|
| HR1 | No fictional members (independent XML re-verification) | **PASS** — all claimed members confirmed present/absent as documented (see §HR1 Evidence) |
| HR2 | Single-ownership (no re-documentation) | **PASS** |
| HR3 | Provenance honesty | **PASS** |
| HR4 | Rhino 8 CPython 3 dialect | **PASS** |

---

## Strengths

- **`ghpython-component.md` is disciplined about scope.** It opens with an explicit "load
  on-demand" blockquote naming exactly what it covers (canvas contract) and what it doesn't
  (RhinoCommon authoring, external-module extraction), then closes with an "Out of Scope Here"
  section that re-affirms the same three pointers by name (`architecture.md`/`SKILL.md`,
  `pitfalls.md`, `api-lookups.md`). This is the single-ownership discipline done right — a
  fresh reader can find the boundary without cross-referencing git history.
- **Provenance tagging is applied consistently, not just declared.** The frontmatter defines
  `[live-verified]` / `[XML-verified]` / `[deck-sourced]` once, and every non-trivial claim in
  the body carries one of the three tags inline (e.g. line 63 `DataTree[object]()` tagged
  `[live-verified under CPython 3]`, line 100 the custom-draw section explicitly split into
  "API XML-verified; runtime-behavior deck-sourced"). This is exactly the honesty bar HR3
  requires, and it was clearly authored with the gate in mind rather than bolted on after.
  Genuinely well-executed self-defense against hallucination.
  - Directory: `optional_plugins/geometry/skills/python-rhino-grasshopper/references/`
- **The `GH_Path(i, j)` treatment is the standout finding of this review.** Rather than either
  asserting a fictional two-int constructor or silently omitting the (functionally real)
  two-int calling convention, the doc states the XML contract precisely (4 ctors, no
  `(Int32,Int32)` overload), separately reports the live-verified runtime behavior (extra
  positional ints bind to the `int[]` ctor), and then recommends the array form as "the one the
  XML actually documents." This is a correct and non-obvious resolution of tension between
  "what the SDK declares" and "what actually works at runtime" — most doc-authoring passes
  would flatten this into one claim and get it wrong in one direction or the other.
- **The API-gate fix in `api-lookups.md` closes a real, previously-exploitable gap.** The old
  worked example only demonstrated grepping `RhinoCommon.xml`; a coder pattern-matching the
  example literally would never think to grep `Grasshopper.xml` for GH-SDK members. The new
  example targets `Grasshopper.Kernel.GH_ScriptInstance.DrawViewportWires` against
  `Grasshopper.xml` explicitly, and the added `GH_IO.XML` scope note (serialization only, not
  canvas/runtime) prevents the opposite mistake of over-grepping the wrong file.
- **`sc.doc`/ProxyDocument pitfall row is well-formed.** It documents the live-verified type
  name (`RhinoCodePlatform.Rhino3D.Languages.GH1.Legacy.ProxyDocument`), gives a concrete
  falsifiable check (`sc.doc is Rhino.RhinoDoc.ActiveDoc` → `False`), the fix
  (`sc.doc = Rhino.RhinoDoc.ActiveDoc` + `finally` restore), and correctly scopes the trap to
  component-context only (documents that Rhino-document-level `sc.doc`, e.g. via `rhinocode`,
  is unaffected) — this avoids over-generalizing a component-specific gotcha into a blanket
  rule that would mislead Lane A-live test authors.

---

## Success Metric Detail

### Metric 1 — Tests green

```
$ python -m pytest tests/ -v
...
============================ 131 passed in 25.93s =============================
```

Fresh run, this session, exit code 0. Matches the pre-registered expectation (doc-only change,
no test-count movement from the prior baseline of 131).

### Metric 2 — Reference quality

- **Frontmatter matches siblings**: none of `pitfalls.md`, `performance.md`, `architecture.md`
  use YAML frontmatter — the sibling convention is `# Title` + a `>` blockquote "load this
  on-demand when..." note. `ghpython-component.md` follows the identical pattern (lines 1–11),
  plus adds the provenance-tag legend inline in the same blockquote. **PASS.**
- **Length**: 136 lines — within the ~≤140 guideline. **PASS.**
- **Leads data trees with `treehelpers`**: "Data Trees in Code" section (lines 46–74) opens
  with "Lead with the ergonomic helper module; drop to the explicit SDK only when you need
  branch-path control the helper doesn't give you," then shows `list_to_tree`/`tree_to_list`
  from `ghpythonlib.treehelpers` *before* the explicit `DataTree`/`GH_Path` SDK path. **PASS.**
- **References rather than restates SKILL.md/architecture.md content**: the "Out of Scope Here"
  closing section explicitly delegates "RhinoCommon authoring conventions, tolerance handling,
  external-module extraction" to `architecture.md`/`SKILL.md` and does not restate any of that
  material in the body. **PASS.**
- **SKILL.md change is only the pointer row**: `git diff main --stat` shows `SKILL.md | 1 +`,
  and the diff content is exactly one new row in the reference-loading table:
  `| references/ghpython-component.md | Authoring/debugging a GHPython script component
  itself — ghenv, trees, native components, custom draw |`. **PASS.**

### Metric 3 — API-gate fix

`api-lookups.md` diff adds:
```
grep_search(Query="M:Grasshopper.Kernel.GH_ScriptInstance.DrawViewportWires", SearchPath="[ABS_PATH]/resources", Includes=["Grasshopper.xml"])
```
— a worked example targeting `Grasshopper.xml`, addressing the prior gap where the deny-list
protocol only demonstrated `RhinoCommon.xml`. The `.BoundingBox` deny-list row is annotated:
"On the GH SDK side, the analogous real member for a script component's custom-draw bounds is
`GH_ScriptInstance.ClippingBox` (a property, XML-verified) — not `BoundingBox`." **PASS.**

---

## HR1 Evidence — Independent XML Re-Verification

All greps run fresh, this session, directly against
`optional_plugins/geometry/skills/python-rhino-grasshopper/resources/{Grasshopper,RhinoCommon}.xml`
— not the coder's claimed member list.

**GH_ScriptInstance custom-draw members** (`Grasshopper.xml`):
```
31258:<member name="P:Grasshopper.Kernel.GH_ScriptInstance.ClippingBox">
31263:<member name="M:Grasshopper.Kernel.GH_ScriptInstance.DrawViewportMeshes(Grasshopper.Kernel.IGH_PreviewArgs)">
31268:<member name="M:Grasshopper.Kernel.GH_ScriptInstance.DrawViewportWires(Grasshopper.Kernel.IGH_PreviewArgs)">
```
All three EXIST as claimed. **CONFIRMED.**

**`GH_ScriptInstance.BoundingBox`** (the member the doc says does NOT exist):
```
grep "GH_ScriptInstance\.BoundingBox" Grasshopper.xml → No matches found
```
Genuinely ABSENT. **CONFIRMED.**

**Runtime messages** (`Grasshopper.xml`):
```
8814:<member name="T:Grasshopper.Kernel.GH_RuntimeMessageLevel">
8819:<member name="F:Grasshopper.Kernel.GH_RuntimeMessageLevel.Blank">
8824:<member name="F:Grasshopper.Kernel.GH_RuntimeMessageLevel.Remark">
8829:<member name="F:Grasshopper.Kernel.GH_RuntimeMessageLevel.Warning">
8834:<member name="F:Grasshopper.Kernel.GH_RuntimeMessageLevel.Error">
8914:<member name="M:Grasshopper.Kernel.IGH_ActiveObject.AddRuntimeMessage(Grasshopper.Kernel.GH_RuntimeMessageLevel,System.String)">
9026:<member name="M:Grasshopper.Kernel.GH_ActiveObject.AddRuntimeMessage(Grasshopper.Kernel.GH_RuntimeMessageLevel,System.String)">
```
Enum + all 4 values + `AddRuntimeMessage(GH_RuntimeMessageLevel,String)` all EXIST. **CONFIRMED.**

**`IGH_Component.Message`** (`Grasshopper.xml`):
```
13179:<member name="P:Grasshopper.Kernel.IGH_Component.Message">
```
EXISTS. **CONFIRMED.**

**`DataTree\`1` members** (`Grasshopper.xml`):
```
49259:<member name="M:Grasshopper.DataTree`1.Add(`0)">
49266:<member name="M:Grasshopper.DataTree`1.Add(`0,Grasshopper.Kernel.Data.GH_Path)">
49283:<member name="M:Grasshopper.DataTree`1.AddRange(System.Collections.Generic.IEnumerable{`0})">
49290:<member name="M:Grasshopper.DataTree`1.AddRange(System.Collections.Generic.IEnumerable{`0},Grasshopper.Kernel.Data.GH_Path)">
49231:<member name="M:Grasshopper.DataTree`1.Branch(System.Int32[])">
49237:<member name="M:Grasshopper.DataTree`1.Branch(Grasshopper.Kernel.Data.GH_Path)">
49243:<member name="M:Grasshopper.DataTree`1.Branch(System.Int32)">
49328:<member name="M:Grasshopper.DataTree`1.Graft(Grasshopper.Kernel.Data.GH_Path,System.Boolean)">
49336:<member name="M:Grasshopper.DataTree`1.Graft(System.Boolean)">
49322:<member name="M:Grasshopper.DataTree`1.Flatten(Grasshopper.Kernel.Data.GH_Path)">
49196:<member name="M:Grasshopper.DataTree`1.EnsurePath(System.Int32[])">
49203:<member name="M:Grasshopper.DataTree`1.EnsurePath(Grasshopper.Kernel.Data.GH_Path)">
```
`Add`, `AddRange`, `Branch`, `Graft`, `Flatten`, `EnsurePath` all EXIST as claimed. **CONFIRMED.**

**`GH_Path` constructors** (`Grasshopper.xml`):
```
22547:<member name="M:Grasshopper.Kernel.Data.GH_Path.#ctor">
22552:<member name="M:Grasshopper.Kernel.Data.GH_Path.#ctor(System.Int32)">
22558:<member name="M:Grasshopper.Kernel.Data.GH_Path.#ctor(System.Int32[])">
22564:<member name="M:Grasshopper.Kernel.Data.GH_Path.#ctor(Grasshopper.Kernel.Data.GH_Path)">
```
Exactly the 4 ctors the doc claims — `()`, `(Int32)`, `(Int32[])`, `(GH_Path)` — and **no**
`(Int32,Int32)` overload. The doc does NOT assert a fictional two-int constructor as
XML-backed: it states "`GH_Path` only declares [the 4 ctors]... (no `GH_Path(int,int)`
overload)," then separately frames the two-int *call* as a `[live-verified]` runtime-binding
behavior ("the runtime binds extra positional ints to the `int[]` constructor"), not as a real
overload, and recommends the array form as the documented contract. **CONFIRMED — correctly
framed, not misrepresented as XML fact.**

**`DisplayPipeline` draw methods** (`RhinoCommon.xml`) and **`IGH_PreviewArgs.Display`**
(`Grasshopper.xml`) — checked as supporting evidence for the custom-draw example:
```
74473:<member name="M:Rhino.Display.DisplayPipeline.DrawPolyline(...)">
74138:<member name="M:Rhino.Display.DisplayPipeline.DrawPoint(Rhino.Geometry.Point3d)">
73996:<member name="M:Rhino.Display.DisplayPipeline.DrawMeshShaded(...)">
30679:<member name="P:Grasshopper.Kernel.IGH_PreviewArgs.Display">
```
All EXIST. **CONFIRMED.**

**HR1 verdict: PASS.** Every member claimed present is present; the one member claimed absent
(`GH_ScriptInstance.BoundingBox`) is genuinely absent; the potentially-fictional two-int
`GH_Path` overload is correctly NOT asserted as an XML-backed contract.

---

## HR2 Evidence — Single Ownership

Grepped both files for the two named facts:

- **`sc.doc` ProxyDocument trap**: full statement (type name, falsifiable check, fix, scope
  caveat) lives ONLY in `pitfalls.md`:
  > `\`sc.doc\` inside a GHPython **component** | Live-verified \`sc.doc\` is
  > \`RhinoCodePlatform.Rhino3D.Languages.GH1.Legacy.ProxyDocument\`, NOT the Rhino document —
  > \`sc.doc is Rhino.RhinoDoc.ActiveDoc\` → \`False\`. ... | \`sc.doc = Rhino.RhinoDoc.ActiveDoc\`
  > at the top of the script, restore the original in a \`finally\`. ...`

  `ghpython-component.md` contains zero occurrences of `sc.doc`/`ProxyDocument` — it only
  points: `- \`sc.doc\` identity trap, GUID-without-Type-hint fix → \`pitfalls.md\` (owner).`
- **GUID-without-Type-hint fix**: full statement (symptom + fix, `rs.coercegeometry`) lives
  ONLY in `pitfalls.md`:
  > `Referenced Rhino object with no Type hint on the GH input | Arrives as a **GUID string**...
  > | Set the input's Type hint to the concrete type, or call \`rs.coercegeometry(guid)\``

  `ghpython-component.md` states the *symptom* in one line ("a referenced Rhino object arrives
  as a **GUID string**... one line here, full trap + fix owned by `pitfalls.md`") but does not
  restate the fix (`rs.coercegeometry`) — it explicitly defers.

**HR2 verdict: PASS.** No fix logic is duplicated across the two files.

---

## HR3 Evidence — Provenance Honesty

Quoted labels, verified against what they're attached to:

- Custom viewport display section header: *"**API XML-verified; runtime-behavior deck-sourced**
  (a full component-subclass draw wasn't exercised live this session — corroborate before
  relying on it in production)."* — correctly downgrades the *behavior* (not the member
  signatures) to deck-sourced, and the member table itself is separately marked `XML` per row.
- `GH_Path(i, j)` binding: *"calling `GH_Path(i, j)` with two bare ints was **[live-verified]**
  to resolve to the same `{i;j}` path... but the array form is the one the XML actually
  documents."* — the runtime-binding behavior is tagged `[live-verified]`, not
  `[XML-verified]`, and is never asserted as an XML-backed overload (cross-checked against HR1
  grep above — no such overload exists).
- `ghenv.Component` resolution: *"`ghenv.Component` [live-verified] resolves to
  `RhinoCodePluginGH.Components.Python3Component`... Members below XML-verified on
  `IGH_Component` / `IGH_ActiveObject`..."* — correctly splits the live-verified *identity*
  claim from the XML-verified *member* claims.
- 2021 workshop-deck callout: *"A 2021 IronPython-era workshop refers to overriding
  `BoundingBox`... does **not** exist on `GH_ScriptInstance` in Rhino 8"* — correctly labels the
  deck as the (wrong) source and the XML grep as the correction.

**HR3 verdict: PASS.** No deck-sourced or live-only claim is asserted as settled/XML-verified
fact.

---

## HR4 Evidence — Rhino 8 CPython 3 Dialect

```
grep -n "print[^(]|<>|list\[|dict\[|Optional\[| \| None| \| str| \| int" ghpython-component.md
124:| `print x` (statement) | `print(x)` |
```

The only IronPython-2 syntax occurrence (`print x`) is inside the "Port Notes: IronPython 2.7 →
CPython 3" contrast table, explicitly juxtaposed against `print(x)` — the permitted exception
per the Hard Rule. No modern-Python union syntax (`X | Y`) or lowercase-generic type hints
(`list[T]`, `dict[K, V]`) appear anywhere in the file; the file has no typed function signatures
to begin with (it's narrative + short inline snippets), so there is no dialect violation to find.

**HR4 verdict: PASS.**

---

## Findings (non-blocking)

None rising to backlog-worthy severity. The one stylistic note — `ghpython-component.md` uses a
markdown table with an escaped backtick literal `DataTree\`1\`` (line 73) which renders oddly in
some viewers — is LOW severity and not worth a BACKLOG entry; flagging here for awareness only,
no action required.

---

## Overall: GO

All 3 success metrics PASS. All 4 Hard Rules PASS with independently-reproduced grep evidence
against the raw XML (not the coder's summary). Tests green (131 passed, exit 0, fresh run).
Auditor recommends merge to `main` and deploy per `DEPLOY.md`. Per TODO authority
(`orchestration.md`), the auditor will mark the corresponding `Artifacts/TODO.md` line `[x]` —
no new tasks added, no BACKLOG entries filed (no deferred findings).
