---
name: cd-foundations
description: Use this skill whenever you are working on a Computational Design (CD) project involving Rhino, Grasshopper, or geometric modeling. It enforces universal constraints like Model Units (mm), Tolerance (0.001mm), and Z-Up orientation, ensuring coordination across teams and software. Trigger this skill automatically at the start of any geometry-related task to establish the coordinate system and precision baseline. Do NOT use for data-only projects (like Power BI) or pure text manipulation unless they interface with a geometric model.
metadata:
  version: "1.0.0"
  tags: [geometry, rhino, grasshopper, standards, coordination]
---

# Skill: CD Foundations

## 📐 Universal Geometric Constraints
All geometry projects MUST adhere to these foundational constraints:

| Constraint | Standard | Rationale |
| :--- | :--- | :--- |
| **Model Units** | Millimeters (mm) | Industry standard for fabrication-level precision. |
| **Tolerance** | 0.001 mm | Prevents boolean failures and manifoldness issues. |
| **Angle Tolerance** | 0.1 Degrees | Ensures precise structural alignments. |
| **Origin** | 0,0,0 | All exports/imports relative to world origin. No "moved" models. |
| **Manifoldness** | Required | All Breps and Meshes must be closed (airtight) unless specified. |

## 🧭 Coordination Rules
1. **Z-Up Orientation**: Rhino default world coordinates apply. Z is always UP.
2. **Layer Discipline**: Use a standard layer hierarchy: `01_Base`, `02_Logic`, `03_Geometry`, `04_Analysis`.
3. **External References**: Path relative to project root. Never use absolute paths to local drives.
4. **Data Trees**: Maintain consistent path structures across GH components. Prefer `{Branch; Index}`.

## 🚩 Geometry Red Flags
- Model units other than MM without explicit project-level override.
- "Naked edges" in final deliverables.
- Duplicate faces or zero-length edges.
- Unsorted point clouds or unordered list logic.
- Absolute paths in file links.

## 🛠 Tooling Standards
- **Kernel**: Rhino 8 (RhinoCommon API).
- **Python**: CPython 3.12 via Rhino 8 bridge.
- **Testing**: Pytest + Rhino.Inside (via `rhino-e2e-testing`).
