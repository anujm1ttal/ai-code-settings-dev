# AUDIT_REPORT.md — GHP-3 Headless GH_IO Serialization Phase Gate

**Auditor** · Branch `phase-ghp-3-gh-io-serialization` · Working tree: dirty (pre-commit
review — nothing committed on this branch yet; all changes are in the working tree)
**Scope**: New `references/gh-io-serialization.md` reference file + one `SKILL.md` pointer
row, in the `python-rhino-grasshopper` skill. (`Artifacts/GLOBAL_INBOX.md` modification is
pre-existing/unrelated per task instructions — not in scope.)

Prior gate report (GHP-2, GHPython component contract) archived to
`Artifacts/History/Reports/GHP-2-AUDIT_REPORT.md` to keep this file scoped to the active gate.

---

## Project Profile (Phase 0)

- **Language**: Markdown (skill/reference authoring). No production application code changed.
- **Domain**: Rhino 8 / Grasshopper — headless `GH_IO.dll` serialization (`.gh`/`.ghx`
  read/write) with no Rhino installation required.
- **Frameworks/APIs referenced**: `GH_IO.Serialization.GH_Archive`, `GH_IO.Serialization.GH_Chunk`,
  `GH_IO.Serialization.GH_IReader`/`GH_IWriter`, `GH_IO.GH_ISerializable`, `GH_IO.Types.GH_Point3D`.
- **Build/Package**: N/A (docs repo).
- **Test/Lint**: `python -m pytest tests/ -v` (this repo's own registry/hook/router suite —
  doc-only change, not expected to move test count).

---

## Verdict: **GO**

| # | Success Metric | Verdict |
|:---|:---|:---|
| 1 | Tests green (`pytest tests/ -v`, expect 131) | **PASS** — `131 passed`, exit code 0 |
| 2 | Reference quality (convention, length, use-case lead, YAGNI framing, thin `SKILL.md` diff) | **PASS** |

| # | Hard Rule | Verdict |
|:---|:---|:---|
| HR1 | No fictional members (independent XML re-verification) | **PASS** |
| HR2 | `WriteToFile_Xml`/`WriteToFile_Binary` claim honestly framed | **PASS** |
| HR3 | Provenance honesty (every claim tagged; persistent-data section labeled not live-exercised) | **PASS** |
| HR4 | No re-documentation (single-ownership — points, doesn't restate) | **PASS** |

---

## Strengths

- **Provenance discipline matches the established convention.** The new doc opens with the same
  three-part structure as the sibling `references/ghpython-component.md`: `# Title`, a `>`
  load-on-demand blockquote naming what it covers and explicitly excludes, and a defined tag
  legend (`[live-verified]` / `[XML-verified]` / `[XML-listed-but-not-callable]`). Every
  non-trivial claim in the body carries one of these tags — this is not a declared-but-unused
  convention, it's applied line-by-line (verified by grep, 14 tag occurrences across 112 lines).
- **The `WriteToFile_Xml`/`WriteToFile_Binary` finding is a genuinely useful, precisely-scoped
  caveat.** Rather than silently omitting these methods or wrongly claiming they don't exist,
  the doc confirms they're real XML-documented members, reports the runtime binding failure
  observed live from pythonnet this session, and gives the working alternative
  (`Serialize_Xml()`/`Serialize_Binary()`/`WriteToFile(...)`) in the same breath. This is exactly
  the kind of "gotcha found probing this API live" content the skill's provenance system exists
  to capture — a coder trusting the doc would try the documented member, hit the same failure,
  and immediately have the fix at hand instead of independently rediscovering it.
- **Scope discipline is tight and self-aware.** The doc leads its final section with the honest
  framing "Honestly out of scope for authoring a Python script-component plugin — YAGNI there,"
  which is an unusually candid thing for a reference doc to say about itself — most docs err
  toward justifying their own existence rather than bounding it. Combined with the two pointer
  lines to `ghpython-component.md` and `grasshopper-plugin-packaging` (rather than restating
  either), this is single-ownership done correctly.
- **Real example data, not a synthetic stub.** The READ Path section's live-verified output
  (`ObjectCount: 5`, real component names from a sample file) is concrete evidence the code was
  actually executed against a real `.gh`/`.ghx` file, not just written and assumed to work.

---

## Success Metrics — Detail

### Metric 1 — Tests Green

Fresh run this session:

```
python -m pytest tests/ -v
...
============================ 131 passed in 26.58s =============================
```

131 passed, exit code 0. Matches the expected count for a doc-only change (no test files
touched, no production code touched). **PASS.**

### Metric 2 — Reference Quality

| Check | Sibling convention (`ghpython-component.md`) | New doc (`gh-io-serialization.md`) | Verdict |
|:---|:---|:---|:---|
| `# Title` heading | Yes | Yes (`# Headless GH_IO Serialization...`) | Match |
| `>` load-on-demand blockquote w/ scope + pointers | Yes | Yes (lines 3–11: scope, pointers to `ghpython-component.md` and `grasshopper-plugin-packaging`, provenance-tag legend) | Match |
| Inline provenance tags | Yes | Yes (`[live-verified]`, `[XML-verified]`, `[XML-listed-but-not-callable]`) | Match |
| Length | 136 lines | 112 lines | Within ~≤115 target |
| Use-case section leads with the differentiator | N/A (component-authoring is its own topic) | "Use Cases & Scoping" section leads: *"Lead use case: **headless CI tooling** — audit, diff, or migrate a `.gh` library ... with no Rhino install in the pipeline."* | Correctly leads with headless-CI angle |
| Honest YAGNI framing | N/A | *"Honestly out of scope for authoring a Python script-component plugin — YAGNI there."* | Present, precisely as required |
| `SKILL.md` diff scope | — | `git diff main` shows exactly one added line: the pointer row `\| references/gh-io-serialization.md \| Reading/writing .gh/.ghx headlessly (GH_IO) — definition-inspection CI tooling, no Rhino required \|` | Confirmed — no other `SKILL.md` content touched |

**PASS** on all sub-checks.

---

## Hard Rule Evidence

### HR1 — No Fictional Members (Independent XML Re-Verification)

Grepped `optional_plugins/geometry/skills/python-rhino-grasshopper/resources/GH_IO.XML`
(6,467 lines) directly — did not trust the doc's own member list.

**`GH_Archive`** (all 10 members named in the doc, confirmed present):
```
97:   <member name="P:GH_IO.Serialization.GH_Archive.GetRootNode">
105:  <member name="M:GH_IO.Serialization.GH_Archive.CreateNewRoot(System.Boolean)">
203:  <member name="M:GH_IO.Serialization.GH_Archive.WriteToFile(System.String,System.Boolean,System.Boolean)">
216:  <member name="M:GH_IO.Serialization.GH_Archive.ReadFromFile(System.String)">
232:  <member name="M:GH_IO.Serialization.GH_Archive.WriteToFile_Xml(System.String)">
239:  <member name="M:GH_IO.Serialization.GH_Archive.WriteToFile_Binary(System.String)">
246:  <member name="M:GH_IO.Serialization.GH_Archive.Serialize_Xml">
253:  <member name="M:GH_IO.Serialization.GH_Archive.Deserialize_Xml(System.String)">
261:  <member name="M:GH_IO.Serialization.GH_Archive.Serialize_Binary">
268:  <member name="M:GH_IO.Serialization.GH_Archive.Deserialize_Binary(System.Byte[])">
```

**`GH_Chunk`** (`FindChunk`/`ChunkCount`/`Items`/`ItemCount`/`Get*`/`Set*`/`ItemExists`/`CreateChunk`
— all confirmed present, e.g.):
```
496:  <member name="P:GH_IO.Serialization.GH_Chunk.Name">
530:  <member name="P:GH_IO.Serialization.GH_Chunk.ItemCount">
535:  <member name="P:GH_IO.Serialization.GH_Chunk.Items">
563:  <member name="M:GH_IO.Serialization.GH_Chunk.ItemExists(System.String)">
655:  <member name="P:GH_IO.Serialization.GH_Chunk.ChunkCount">
667:  <member name="M:GH_IO.Serialization.GH_Chunk.FindChunk(System.String)">
713:  <member name="M:GH_IO.Serialization.GH_Chunk.CreateChunk(System.String)">
833:  <member name="M:GH_IO.Serialization.GH_Chunk.SetInt32(System.String,System.Int32)">
1447: <member name="M:GH_IO.Serialization.GH_Chunk.GetInt32(System.String)">
```
(full grep also confirmed `GetString`, `GetGuid`, `GetBoolean`, `GetPoint3D`, `SetString`,
`SetGuid`, `SetBoolean`, `SetPoint3D`, `FindItem`, `ChunkExists`, `.Chunks`, `.Index` — all
present, none fictional.)

**`GH_IReader`/`GH_IWriter`** (interface members, confirmed same signatures exist independently
of `GH_Chunk`):
```
2781: <member name="T:GH_IO.Serialization.GH_IWriter">
2796: <member name="M:GH_IO.Serialization.GH_IWriter.CreateChunk(System.String)">
2897: <member name="M:GH_IO.Serialization.GH_IWriter.SetInt32(System.String,System.Int32)">
3454: <member name="T:GH_IO.Serialization.GH_IReader">
3459: <member name="M:GH_IO.Serialization.GH_IReader.FindChunk(System.String)">
3521: <member name="M:GH_IO.Serialization.GH_IReader.ItemExists(System.String)">
3587: <member name="M:GH_IO.Serialization.GH_IReader.GetInt32(System.String)">
```

**`GH_ISerializable.Read`/`.Write`**:
```
6156: <member name="T:GH_IO.GH_ISerializable">
6162: <member name="M:GH_IO.GH_ISerializable.Write(GH_IO.Serialization.GH_IWriter)">
6169: <member name="M:GH_IO.GH_ISerializable.Read(GH_IO.Serialization.GH_IReader)">
```

Every member named in the doc — including the full `Get*`/`Set*` typed-accessor family, both
overload shapes (`name` / `name, index`), and all three top-level types — resolves to a real
entry in `GH_IO.XML`. No fictional members found. **HR1: PASS.**

### HR2 — `WriteToFile_Xml`/`WriteToFile_Binary` Claim Honestly Framed

Confirmed both members exist in `GH_IO.XML`:
```
232:  <member name="M:GH_IO.Serialization.GH_Archive.WriteToFile_Xml(System.String)">
233:      <summary>Serializes the current data tree into an Xml Grasshopper file.</summary>
239:  <member name="M:GH_IO.Serialization.GH_Archive.WriteToFile_Binary(System.String)">
240:      <summary>Serializes the current data tree into a Binary Grasshopper file.</summary>
```

Doc's exact wording (lines 91–95):
> "2. **`WriteToFile_Xml(string)` / `WriteToFile_Binary(string)` are listed in `GH_IO.XML`**
> (`M:GH_IO.Serialization.GH_Archive.WriteToFile_Xml`/`WriteToFile_Binary`) but pythonnet could
> not call them at runtime this session. [XML-listed-but-not-callable] Public write API
> confirmed working: `Serialize_Xml()`, `Serialize_Binary()`, `WriteToFile(string, bool, bool)`
> [XML-verified + live-verified]."

This is precisely framed as a **runtime-binding observation** ("pythonnet could not call them
at runtime this session"), not a "member doesn't exist" claim — the doc explicitly states they
are XML-listed. The tag itself (`[XML-listed-but-not-callable]`) encodes the distinction in its
name. This is the correct, non-fictional characterization. **HR2: PASS.**

### HR3 — Provenance Honesty

All claims carry one of the three declared tags (14 tag instances across the 112-line doc,
confirmed by grep — no untagged non-trivial technical claim found). The specific
component-persistent-data callout required by this gate:

> "[XML-verified, not live-exercised this session — treat with more caution] Custom components
> implement `GH_IO.GH_ISerializable` ... and override `Write(GH_IWriter)` / `Read(GH_IReader)`
> to persist state into the `.gh`..."

This is labeled exactly as required — **not** asserted as tested/live-verified, explicitly
flagged "not live-exercised this session" with a caution note. **HR3: PASS.**

### HR4 — No Re-Documentation (Single-Ownership)

Grep confirms both cross-references are pointer-only:

- `.gh`-vs-`.ghx` version-control policy: doc says (line 6) *"...or for `.gh`-vs-`.ghx`
  version-control policy (owned by `grasshopper-plugin-packaging`)"* and again (lines 25–27)
  *"This is the mechanism behind the packaging skill's 'commit `.ghx`, not `.gh`' guidance —
  see `grasshopper-plugin-packaging` for that policy, not restated here."* Confirmed the target
  skill exists (`optional_plugins/geometry/skills/grasshopper-plugin-packaging/SKILL.md:113`,
  `:134` carry the actual policy: *"Version control `.ghx` (XML, diffable), not `.gh` (binary)"*
  and *"`.ghx` committed, not `.gh`."*). The new doc names the conclusion in a single clause for
  reader orientation but does not restate the diffability rationale, CI implications, or the
  numbered checklist that the packaging skill owns.
- GHPython component-authoring content: doc says (lines 4–6) *"Not needed for authoring a
  script component's own logic (see `ghpython-component.md`)"* — a bare pointer, no content
  duplicated. The doc's own "Component Persistent Data" section covers `GH_ISerializable`,
  which does **not** appear anywhere in `ghpython-component.md` (confirmed by reading that file
  in full) — so this is new, non-overlapping content, not a restatement.

No architecture.md content restated either (not referenced/needed here). **HR4: PASS.**

---

## Overall: GO

All success metrics and all four Hard Rules pass with independently-verified evidence. No
fixes required. Task remains marked by the coder as ready for auditor sign-off — per TODO
Authority (`orchestration.md`), the auditor marks `[x]`; this report is the evidence trail for
that mark, made in a separate step outside this report per the reporting boundary set for this
audit.

**Recommendation**: Proceed to phase merge (`phase-ghp-3-gh-io-serialization` → `main`) per
Git Phase Branching §4 (merge only after auditor confirms all success metrics met — confirmed
above).
