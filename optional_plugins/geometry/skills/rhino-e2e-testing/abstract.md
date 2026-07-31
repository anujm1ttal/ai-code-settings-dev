# Skill Abstract: Rhino E2E Testing (L0)

**Purpose**: Headless/live end-to-end verification of RhinoCommon geometry and Grasshopper state (Lane A).

**Core Logic**:
- **Lane Decision Tree**: Geometric invariants (manifoldness, Brep ops) → Lane A; geometry-agnostic logic → Lane B (`rhino-unit-testing`).
- **Lane A-headless** (pytest + rhinoinside) for core logic/CI; **Lane A-live** (`rhinocode` CLI) when plugins/document state require a running instance; **Lane A-full** as last resort (manual UI).
- Tolerance-aware comparisons mandatory — never assert exact floats on geometry.
- **Lane A-live traps** (load this skill before any one-off probe, not just before a test run): `rhinocode` returns **exit 0 before the script finishes**, its **stdout never reaches the caller**, and a **relative script path runs nothing** (the in-process cwd is Rhino's install dir). All three look identical to success. Remedy: `resources/probe_harness.py` — absolute paths, in-script output capture, terminal sentinel, caller polls for it.
- **Mutating probes** run exactly once — never retry on timeout or an empty report.

**Constraint**: Do NOT use for pure Python logic with no Rhino runtime dependency — use `rhino-unit-testing`.
