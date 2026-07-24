# Rhino Geometry Pitfalls & Hallucinations

> Load this on-demand when debugging geometry failures, mesh errors, or resolving API signatures.
> Aligned with Rhino 8 / CPython 3.9 standards.

## 🔧 Common Pitfalls

| Pitfall | Symptom | Fix |
| :--- | :--- | :--- |
| Hardcoded tolerance | Geometry joins fail in different models | Use `doc.ModelAbsoluteTolerance` |
| Flatten in loop | Exponential slowdown on large models | Maintain path hierarchy, flatten only at final output |
| Non-unitized vectors | Unpredictable translation magnitudes | `.Unitize()` before every transform |
| Undisposed meshes | Memory leak, GH freeze on large models | `try/finally` dispose pattern |
| Single-threaded groups | Large models take 10+ minutes | `Parallel.ForEach` on independent groups |
| Fat GH component | Impossible to debug, test, or reuse | Extract to external module, keep GH as thin wrapper |
| Bare `rhinoinside.load()` | Silently loads Rhino 7 on multi-version machines | See `rhino-e2e-testing` skill Troubleshooting — always `rhinoinside.load(8)` explicitly |
| `doc.Undo()` | Returns `True` but restores nothing — a silent no-op, not a rollback | Use the command, not the API: `Rhino.RhinoApp.RunScript("_Undo", False)`. Undo depth is not always 1 — one logical mutation can need multiple `_Undo` calls; loop until a pre-mutation snapshot matches, never assume depth 1 |
| Default object enumeration (`doc.Objects`) | Silently skips objects on invisible/locked **layers** (measured: 11 of 225 objects missed on a live doc) | Enumerate with explicit settings: `st = Rhino.DocObjects.ObjectEnumeratorSettings(); st.NormalObjects = st.LockedObjects = st.HiddenObjects = True; doc.Objects.GetObjectList(st)` |
| `doc.Modified` as a change/safety gate | Unreliable signal — a plugin can re-dirty the document continuously, or it reads `True` immediately after a `Save As` | Never trust it as a gate; snapshot-and-compare the specific state you care about |
| `grep`/text search on `.dll`/`.gha`/`.gh`/`.3dm` | False "not found" — .NET and Grasshopper store strings as UTF-16LE, not ASCII | Scan ASCII **and** UTF-16LE (and UTF-16BE) before concluding a literal is absent |
| `rhinocode ... script` (relative path / exit timing) | Relative path silently runs nothing; exits `0` before the script finishes | See `rhino-e2e-testing` skill (Lane A-live section) — absolute-path rule and sentinel-poll pattern owned there |
| Bare `rhinocode script`/`command` (no `-r`) | Ambiguous instance resolution — with >1 Rhino open (or a first-regex-match resolver), can silently run against the WRONG document or a non-Rhino `compute.geometry` pipe | Resolve via `rhinocode list --json` filtered to `processName=="Rhino"`, always pass `-r <pipeId>`, and add a `RHINO_DOC_HINT` guard for mutating probes — owned by `rhino-e2e-testing` skill |
| `sc.doc` inside a GHPython **component** | Live-verified `sc.doc` is `RhinoCodePlatform.Rhino3D.Languages.GH1.Legacy.ProxyDocument`, NOT the Rhino document — `sc.doc is Rhino.RhinoDoc.ActiveDoc` → `False`. `rs` calls, `ModelAbsoluteTolerance`, and object-add calls silently hit the wrong document | `sc.doc = Rhino.RhinoDoc.ActiveDoc` at the top of the script, restore the original in a `finally`. (At Rhino *document* level — e.g. via `rhinocode` — `sc.doc` IS the RhinoDoc; this trap is component-context-specific.) |
| Referenced Rhino object with no Type hint on the GH input | Arrives as a **GUID string**, not a RhinoCommon object — geometry calls fail with attribute errors | Set the input's Type hint to the concrete type, or call `rs.coercegeometry(guid)` |

## 🚫 Common API Hallucinations (DENY LIST)

**NEVER use these properties/methods** — they are common LLM hallucinations. Follow the correction in the "Reality" column.

| Hallucination | Reality | Context |
| :--- | :--- | :--- |
| `obj.BoundingBox` | `obj.GetBoundingBox(True)` | GeometryBase (Curves, Breps, Meshes) |
| `rs.CreateTextStyle()` | Does NOT exist | Use `sc.doc.DimStyles.Add(name)` |
| `GH_Path(i)` | `GH_Path(i, j)` | Always use explicit multi-D paths for DataTrees |
| `doc.DimStyles.Add(obj)` | `doc.DimStyles.Add(string)` | Method only accepts a unique name string |
| `rs.IsTextStyle()` | Does NOT exist | Check `sc.doc.DimStyles.FindName(name)` |
| `doc.UndoRecordCount()` | Does NOT exist on `RhinoDoc` | Assert the member exists before use; do not assume a plausible-sounding name is real |
| `doc.DefaultLayerIndex` | Does NOT exist on `RhinoDoc` | Assert the member exists before use; do not assume a plausible-sounding name is real |

## 🚫 Anti-Patterns

- ❌ `rhinoscriptsyntax` for dimension/annotation styles — limited API, use RhinoCommon.
- ❌ `DimStyles.Add(style_object)` — expects name string, not object.
- ❌ `DimensionStyle.LeaderContentAngleType.Horizontal` — use integer `1`.
- ❌ `str | None` syntax — Rhino Python targets <3.10; use `Optional[str]` from `typing`.
- ❌ `logging.basicConfig()` without explicit file target — output is swallowed by Rhino.
- ❌ Exact float equality in geometry assertions — always use `pytest.approx`.

## ⚠️ Platform Constraints

- **Logging**: `logging.basicConfig()` output is swallowed — use `print()` or file logging with explicit `filename=`.
- **Script Editor**: Command-line options render in the Rhino viewport, not the editor output.
- **Enums**: .NET nested enum paths often fail to resolve in Rhino Python. Use raw integers and document the magic numbers.
- **Threading**: RhinoCommon **reads** from a background thread are safe — no forced hop to the UI thread needed. Writes/mutations are a different contract; do not generalize this to mutation.
