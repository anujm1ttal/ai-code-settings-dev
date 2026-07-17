# Reference: API Lookups & Hallucination Guard

This document defines the mandatory lookup protocol for the RhinoCommon and Grasshopper APIs to prevent hallucinations of properties and methods.

## 📖 API Reference Lookups (MANDATORY)

> [!CAUTION]
> LLMs frequently hallucinate properties (e.g., `.BoundingBox` vs `.GetBoundingBox()`). You MUST use the **absolute path** to the resources directory in your `grep_search`.

### Resource Directory
`skills/python-rhino-grasshopper/resources/` (Resolve to absolute path before use)

### Target Files
- `RhinoCommon.xml`: Core Rhino geometry and document operations.
- `Grasshopper.xml`: Component SDK and canvas manipulation.
- `GH_IO.XML`: File serialization and deserialization.

### Search Protocol
You are FORBIDDEN from guessing API signatures. Use the protocol below to verify:

```bash
grep_search(Query="M:Rhino.Geometry.Brep.CreateFromSweep", SearchPath="[ABS_PATH]/resources", Includes=["RhinoCommon.xml"])
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
| `brep.BoundingBox` | `brep.GetBoundingBox(True)` | Methods often require a boolean for accuracy. |
| `rs.IsTextStyle` | No direct RhinoCommon equivalent | Check `doc.TextStyles` collection. |
| `rs.CreateTextStyle` | `doc.TextStyles.Add("name")` | Use the collection Add method. |
| `curve.Length` | `curve.GetLength()` | Curves usually have methods for length. |
| `point.DistanceTo(p)` | `(p1 - p2).Length` or `DistanceTo` | Check if it's a static or instance method. |

If a member is not found in the XML, it DOES NOT EXIST. Do not "invent" it.
