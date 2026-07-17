# GHPython Component Runtime Contract (Rhino 8, CPython 3)

> Load this on-demand when authoring or debugging a GHPython **script component** itself —
> the canvas contract (I/O, `ghenv`, trees, native components, persistence, custom draw).
> For external-module structure and general authoring rules, see `architecture.md` /
> `SKILL.md`. For traps and hallucinations, see `pitfalls.md` (this file only points to it).
>
> Provenance tags on every idiom: **[live-verified]** = run in Rhino 8 CPython 3.9.10 this
> session, **[XML-verified]** = confirmed present in `resources/Grasshopper.xml`, **[deck-sourced]**
> = derived from a 2021 IronPython workshop deck, not re-verified this session — treat with
> more caution.

## Component I/O

- Each canvas **input** becomes a Python variable in the component's scope; each canvas
  **output** is set by assigning to a same-named variable.
- **Access** (right-click an input): `Item` (single value), `List` (Python `list`), `Tree`
  (`Grasshopper.DataTree`). Defaults to `Item`.
- **Type hints** (right-click an input): coerce the incoming data to a concrete type
  (`Point3d`, `Curve`, `Brep`, `str`, `int`, …) before your code runs. `str` and `float` are the
  worst catch-all — prefer the specific geometry hint.
- **Without a Type hint**, a referenced Rhino object arrives as a **GUID string**, not a
  RhinoCommon object — one line here, full trap + fix owned by `pitfalls.md`.
- `print()` output routes to the component's `out` param (visible on hover / in the Python
  editor's output pane), not to the Rhino command line.

## `ghenv.Component`

`ghenv.Component` [live-verified] resolves to `RhinoCodePluginGH.Components.Python3Component`,
an `IGH_Component`. Members below XML-verified on `IGH_Component` / `IGH_ActiveObject`
(interfaces the runtime type implements):

| Member | Signature | Verified |
| :--- | :--- | :--- |
| `.Message` | `P:Grasshopper.Kernel.IGH_Component.Message` — get/set custom text under the component | XML |
| `.AddRuntimeMessage(level, text)` | `M:Grasshopper.Kernel.IGH_ActiveObject.AddRuntimeMessage(GH_RuntimeMessageLevel,System.String)` | XML |
| `GH_RuntimeMessageLevel` | enum values `{Blank, Remark, Warning, Error}` (`T:Grasshopper.Kernel.GH_RuntimeMessageLevel`) | XML |

```python
ghenv.Component.Message = "v2.1"
ghenv.Component.AddRuntimeMessage(Warning, "Tolerance below doc.ModelAbsoluteTolerance")
```
`Warning`/`Error`/`Remark` are pulled from `Grasshopper.Kernel.GH_RuntimeMessageLevel` — import
or reference qualified as needed.

## Data Trees in Code

Lead with the ergonomic helper module; drop to the explicit SDK only when you need branch-path
control the helper doesn't give you.

**Ergonomic path** [live-verified]:
```python
from ghpythonlib.treehelpers import list_to_tree, tree_to_list
tree = list_to_tree(nested_list)      # nested Python list -> DataTree
data = tree_to_list(tree)             # DataTree -> nested Python list
```

**Explicit SDK** (path control):
```python
from Grasshopper import DataTree
from Grasshopper.Kernel.Data import GH_Path

tree = DataTree[object]()             # generic-bracket instantiation [live-verified under CPython 3]
tree.Add(value, GH_Path(0))           # {0} — single-index path, XML-verified ctor `GH_Path(System.Int32)`
```
`GH_Path` only declares `#ctor()`, `#ctor(System.Int32)`, `#ctor(System.Int32[])`, and
`#ctor(GH_Path)` in the XML (no `GH_Path(int,int)` overload) — a multi-index path like `{i;j}`
needs `GH_Path([i, j])`; calling `GH_Path(i, j)` with two bare ints was **[live-verified]** to
resolve to the same `{i;j}` path (the runtime binds extra positional ints to the `int[]`
constructor), but the array form is the one the XML actually documents — prefer it if you want
the documented contract.

XML-verified `DataTree`1` members: `Add(T[,GH_Path])`, `AddRange(IEnumerable[,GH_Path])`,
`Branch(GH_Path)`, `Graft(GH_Path,bool)` / `Graft(bool)`, `Flatten(GH_Path)`, `EnsurePath(...)`.

## Calling Native Components

```python
import ghpythonlib.components as ghcomp
result = ghcomp.Voronoi(points, radius, boundary)   # [live-verified]
```
Wraps the compiled GH component under a Python function call — useful for reusing native
solvers (Voronoi, Delaunay, etc.) without wiring them on the canvas.

## Persistent State (`scriptcontext.sticky`)

`sc.sticky` [live-verified] is a dict-like cache that survives across solutions and is shared
between components in the same document — use it to memoize expensive builds, not as a
substitute for proper data flow:
```python
import scriptcontext as sc
key = "my_component_cache_v1"
if key not in sc.sticky:
    sc.sticky[key] = build_expensive_structure()
result = sc.sticky[key]
```

## Custom Viewport Display (Draw Without Baking)

**API XML-verified; runtime-behavior deck-sourced** (a full component-subclass draw wasn't
exercised live this session — corroborate before relying on it in production).

To draw preview geometry without baking, override on the script component's base class
(`GH_ScriptInstance`, `T:Grasshopper.Kernel.GH_ScriptInstance`):

| Member | Signature | Verified |
| :--- | :--- | :--- |
| `DrawViewportWires(args)` | `M:Grasshopper.Kernel.GH_ScriptInstance.DrawViewportWires(IGH_PreviewArgs)` | XML |
| `DrawViewportMeshes(args)` | `M:Grasshopper.Kernel.GH_ScriptInstance.DrawViewportMeshes(IGH_PreviewArgs)` | XML |
| `ClippingBox` | `P:Grasshopper.Kernel.GH_ScriptInstance.ClippingBox` — must return a valid bounding box for Rhino to frame/zoom the draw | XML |
| `args.Display` | `P:Grasshopper.Kernel.IGH_PreviewArgs.Display` — the `Rhino.Display.DisplayPipeline` to draw through | XML |

> A 2021 IronPython-era workshop refers to overriding `BoundingBox` — that member does **not**
> exist on `GH_ScriptInstance` in Rhino 8; the correct property is `ClippingBox`.

Draw through the pipeline object, e.g. `args.Display.DrawPolyline(...)`,
`args.Display.DrawPoint(...)`, `args.Display.DrawMeshShaded(...)` (all XML-verified on
`Rhino.Display.DisplayPipeline`).

## Port Notes: IronPython 2.7 → CPython 3

| IronPython 2.7 | CPython 3 (Rhino 8) |
| :--- | :--- |
| `print x` (statement) | `print(x)` |
| `reload(module)` | `importlib.reload(module)` |
| `ghpythonlib.parallel` / `System.Threading` | `concurrent.futures` / native `threading` (the old APIs may still work, but are not the idiomatic path) |

**Rule**: parallelize PURE computation only. Never touch the GH document, viewport display, or
bake from a worker thread — those are main-thread-only operations regardless of runtime.

## Out of Scope Here

- RhinoCommon authoring conventions, tolerance handling, external-module extraction →
  `architecture.md` / `SKILL.md`.
- `sc.doc` identity trap, GUID-without-Type-hint fix → `pitfalls.md` (owner).
- API lookup protocol / grep workflow → `api-lookups.md` (owner).
