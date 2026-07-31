# Reference: API Lookups & Hallucination Guard

This document defines the mandatory lookup protocol for the RhinoCommon and Grasshopper APIs to prevent hallucinations of properties and methods.

## 📖 API Reference Lookups (MANDATORY)

> [!CAUTION]
> LLMs frequently hallucinate properties (e.g., `.BoundingBox` vs `.GetBoundingBox()`). This
> skill ships the real signature database offline — grep it, never guess.

### Resource Directory

Every lookup below runs against **API_RESOURCES** — the resources path from the *Environment
and Paths* block in `SKILL.md`. Resolve that token to its absolute value first, then substitute
it wherever `<API_RESOURCES>` appears here.

This file is **read on demand**, not injected, so it deliberately does not spell
`${CLAUDE_PLUGIN_ROOT}` itself — a `Read` would hand you the literal text rather than the
substituted path. `SKILL.md` is the single place that value is defined, and the only place the
substitution-failed check applies.

A relative path (`resources/`, `skills/python-rhino-grasshopper/resources/`) resolves against
the **consuming project's** cwd, finds nothing, and silently disables this entire gate.

### Target Files
- `RhinoCommon.xml`: Core Rhino geometry and document operations.
- `Grasshopper.xml`: Component SDK and canvas manipulation.
- `GH_IO.XML`: File serialization and deserialization.

### Search Protocol
You are FORBIDDEN from guessing API signatures. Use the protocol below to verify:

```
Grep(
  pattern="M:Rhino.Geometry.Brep.CreateFromSweep",
  path="<API_RESOURCES>",
  glob="RhinoCommon.xml",
  output_mode="content"
)
```

The same protocol applies to the Grasshopper SDK — do not skip this gate just because the
member is `Grasshopper.Kernel.*` instead of `Rhino.Geometry.*`:

```
Grep(
  pattern="M:Grasshopper.Kernel.GH_ScriptInstance.DrawViewportWires",
  path="<API_RESOURCES>",
  glob="Grasshopper.xml",
  output_mode="content"
)
```

- **M:** denotes a Method.
- **P:** denotes a Property.
- **T:** denotes a Type (Class/Enum).

### XML First, Probe Only for Behavior

For any "does member X exist / what is its signature" question, grep `RhinoCommon.xml`
**before** live member-probing on the object. The XML is definitive for the API *contract*
and carries zero runtime risk — one grep resolves a whole fictional-member cascade at once
(e.g. `BrepFace` has no `Area`/`IsPlane`/`Normal`/`Vertices`; `AreaMassProperties` has no
`Volume`; `Brep` has no `Centroid`/`Face`), replacing a member-by-member probe loop that can
wedge the runtime. Reserve live probing for *behavior* (actual values, degradation, side
effects), and corroborate each source against the other.

## 🚫 Hallucination Deny List

Commonly hallucinated members to AVOID (check API before using):

| Hallucination | Correct Alternative | Context |
| :--- | :--- | :--- |
| `brep.BoundingBox` | `brep.GetBoundingBox(True)` | Methods often require a boolean for accuracy. On the GH SDK side, the analogous real member for a script component's custom-draw bounds is `GH_ScriptInstance.ClippingBox` (a property, XML-verified) — not `BoundingBox`. |
| `rs.IsTextStyle` | No direct RhinoCommon equivalent | Check `doc.TextStyles` collection. |
| `rs.CreateTextStyle` | `doc.TextStyles.Add("name")` | Use the collection Add method. |
| `curve.Length` | `curve.GetLength()` | Curves usually have methods for length. |
| `point.DistanceTo(p)` | `(p1 - p2).Length` or `DistanceTo` | Check if it's a static or instance method. |

If a member is not found in the XML, it DOES NOT EXIST. Do not "invent" it.

`GH_IO.XML` covers file **serialization** (`GH_Archive`, `GH_IReader`/`GH_IWriter`) — grep it
only when reading/writing `.gh`/`.ghx` state, not for canvas/runtime members.
