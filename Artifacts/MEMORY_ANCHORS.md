# Memory Anchors: [Project Name]

**Cold Storage**: Critical project-wide constants, non-negotiable constraints, and system boundaries. 
*Maintenance: Strategist owns this file. Graduation from LEARNINGS.md happens during /handoff.*

## 📐 Non-Negotiables
- [Anchor 1]: e.g., "All sightline calculations must use a C-Value threshold of 60mm."
- [Anchor 2]: e.g., "Database schema is read-only; use staging for all writes."

## 🧱 Architectural Boundaries
- [Boundary 1]: e.g., "RhinoCommon is the sole geometric library; no external DLLs."
- [Boundary 2]: e.g., "Python 3.9 compatibility for all GH components."

## 🔢 Key Constants
| Constant | Value | Source |
|:---|:---|:---|
| `MIN_TOLERANCE` | `0.001` | RhinoDoc Units |
| `MAX_PAGE_COUNT` | `7` | powerbi-report skill |

## 🛠 Active Toolchain
- **Geometry**: Rhino 8 + Grasshopper
- **Testing**: Pytest + Rhino.Inside
- **Power BI**: PBIP format + Tabular Editor 3
