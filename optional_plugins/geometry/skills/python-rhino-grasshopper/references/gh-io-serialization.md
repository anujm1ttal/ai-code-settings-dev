# Headless GH_IO Serialization (.gh / .ghx, No Rhino Required)

> Load this on-demand when reading, writing, or inspecting Grasshopper `.gh`/`.ghx` files
> programmatically — CI tooling, definition audits/diffs, or migration scripts. Not needed
> for authoring a script component's own logic (see `ghpython-component.md`) or for
> `.gh`-vs-`.ghx` version-control policy (owned by `grasshopper-plugin-packaging`).
>
> Provenance tags: **[live-verified]** = run in Rhino 8 CPython 3.9.10 this session via
> `rhinocode` + pythonnet, **[XML-verified]** = confirmed present in `resources/GH_IO.XML`,
> **[XML-listed-but-not-callable]** = present in the XML doc but failed at runtime from
> pythonnet.

## What It Is

`GH_IO.dll` is Grasshopper's serialization layer, **Rhino-free by design** — it ships its own
`GH_IO.Types.GH_Point3D`/`GH_Plane`/`GH_BoundingBox` so the file format has no RhinoCommon
dependency. Consequence: a `.gh`/`.ghx` definition can be read, written, or inspected with only
`GH_IO.dll` + pythonnet (or a small C# exe) — **no Rhino installation required**. [live-verified
via `rhinocode` this session only for convenient DLL resolution; the library itself needs no Rhino]

## `.gh` vs `.ghx`

Both formats serialize the same `GH_Archive` object graph — `.gh` is binary
(`Serialize_Binary`/`Deserialize_Binary`), `.ghx` is XML (`Serialize_Xml`/`Deserialize_Xml`),
both `M:GH_IO.Serialization.GH_Archive.*` [XML-verified]. This is the mechanism behind the
packaging skill's "commit `.ghx`, not `.gh`" guidance — see `grasshopper-plugin-packaging` for
that policy, not restated here. The `.ghx` root element is `<Archive name="Root">` [live-verified].

## READ Path

```python
#! python 3
import clr; clr.AddReference("GH_IO")
from GH_IO.Serialization import GH_Archive

a = GH_Archive()
a.ReadFromFile(path)                        # -> True  (or a.Deserialize_Xml(xml_string))
root = a.GetRootNode                        # GH_Chunk, acts as reader
defn = root.FindChunk("Definition")
props = defn.FindChunk("DefinitionProperties")
doc_name = props.GetString("Name") if props.ItemExists("Name") else None
objs = defn.FindChunk("DefinitionObjects")
n = objs.GetInt32("ObjectCount")
for i in range(n):
    ob = objs.FindChunk("Object", i)
    name = ob.GetString("Name") if ob.ItemExists("Name") else "?"
    cont = ob.FindChunk("Container")
    nick = cont.GetString("NickName") if cont and cont.ItemExists("NickName") else None
```
[live-verified] Real output from this exact code on a sample file: `ObjectCount: 5`, components
`['WT_BuildingSelector.gh [WT]', 'Number Slider', 'Panel', 'Number Slider', 'Number Slider']`.

## Reader/Writer API

`GH_Chunk` (`T:GH_IO.Serialization.GH_Chunk`) is BOTH reader and writer, implementing
`GH_IReader`/`GH_IWriter`. [XML-verified members]

| Member | Purpose |
| :--- | :--- |
| `FindChunk(name[, index])`, `ChunkExists(name[, index])` | Navigate to a child chunk |
| `FindItem(name[, index])`, `ItemExists(name[, index])` | Navigate to a leaf value |
| `.Chunks`, `.ChunkCount` | Enumerate child chunks |
| `.Items`, `.ItemCount` | Enumerate leaf values |
| `.Name`, `.Index` | This chunk's identity |
| `CreateChunk(name[, index])` | Add a child chunk (writer) |
| `GetInt32`/`GetString`/`GetGuid`/`GetBoolean`/`GetPoint3D`(name[, index]) | Typed reads |
| `SetInt32`/`SetString`/`SetGuid`/`SetBoolean`/`SetPoint3D`(name[, value][, index]) | Typed writes |

Same signatures also exist directly on the `GH_IReader`/`GH_IWriter` interfaces
(`T:GH_IO.Serialization.GH_IReader`, `T:GH_IO.Serialization.GH_IWriter`) — `GH_Chunk` is the
concrete type you actually get back from `GetRootNode`/`FindChunk`. [XML-verified]

## WRITE Path

```python
a = GH_Archive()
a.CreateNewRoot(True)          # returns void — do NOT assign it
root = a.GetRootNode           # the writer (GH_Chunk)
root.SetInt32("Count", 42); root.SetString("Msg", "hi")
child = root.CreateChunk("MyChunk"); child.SetBoolean("Flag", True)
xml = a.Serialize_Xml()        # -> str; or a.Serialize_Binary(); or a.WriteToFile(path, ...)
```
[live-verified round-trip] Write -> `Deserialize_Xml` -> values read back identical.

## pythonnet Idiom Notes

Three gotchas found probing this API live this session:

1. `CreateNewRoot(System.Boolean)` returns **void** [XML-verified signature] — get the writer
   via `GetRootNode` afterward, don't assign its return value. [live-verified]
2. **`WriteToFile_Xml(string)` / `WriteToFile_Binary(string)` are listed in `GH_IO.XML`**
   (`M:GH_IO.Serialization.GH_Archive.WriteToFile_Xml`/`WriteToFile_Binary`) but pythonnet could
   not call them at runtime this session. [XML-listed-but-not-callable] Public write API
   confirmed working: `Serialize_Xml()`, `Serialize_Binary()`, `WriteToFile(string, bool, bool)`
   [XML-verified + live-verified].
3. The `.NET` `TryGetX(name, out val)` overloads bind awkwardly from pythonnet's `out`-param
   marshaling — from Python, prefer `ItemExists(name)` + `GetX(name)` instead. [live-verified]

## Component Persistent Data

[XML-verified, not live-exercised this session — treat with more caution] Custom components
implement `GH_IO.GH_ISerializable` (`T:GH_IO.GH_ISerializable`) and override
`Write(GH_IWriter)` / `Read(GH_IReader)` to persist state into the `.gh` (`w.SetInt32(...)` /
`r.GetInt32(...)`). Primarily a **C# `.gha`** concern — Python script components don't
typically implement this interface directly.

## Use Cases & Scoping

Lead use case: **headless CI tooling** — audit, diff, or migrate a `.gh` library (list
components, check naming conventions, detect drift) with no Rhino install in the pipeline.
Honestly out of scope for authoring a Python script-component plugin — YAGNI there. Reach for
`GH_IO` directly only for definition-inspection tooling or C# `.gha` persistent-data code.
