# Skill Abstract: Rhino E2E Testing (L0)

**Purpose**: Headless/live end-to-end verification of RhinoCommon geometry and Grasshopper state (Lane A).

**Core Logic**:
- **Lane Decision Tree**: Geometric invariants (manifoldness, Brep ops) → Lane A; geometry-agnostic logic → Lane B (`rhino-unit-testing`).
- **Lane A-headless** (pytest + rhinoinside) for core logic/CI; **Lane A-live** (`rhinocode` CLI) when plugins/document state require a running instance; **Lane A-full** as last resort (manual UI).
- Tolerance-aware comparisons mandatory — never assert exact floats on geometry.

**Constraint**: Do NOT use for pure Python logic with no Rhino runtime dependency — use `rhino-unit-testing`.
