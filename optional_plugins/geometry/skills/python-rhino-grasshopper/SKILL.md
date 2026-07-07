---
name: python-rhino-grasshopper
description: "Expert in RhinoCommon API, GhPython, and computational design scripting for Rhino 8. Mandates the use of 'Rhino.Geometry', high-rigor patterns, and strict CPython 3.9 compliance. Use this skill whenever writing, refactoring, or reviewing Python code that interacts with the Rhino runtime or Grasshopper SDK. Trigger when the user mentions 'Rhino', 'Grasshopper', 'geometry', or 'brep'. Use whenever implementing structural logic or data tree management. Do NOT use for pure Python math or logic that doesn't depend on Rhino (use rhino-unit-testing instead)."
argument-hint: "[stadium|facade|landscape|furniture|general] <geometric goal>"
model: claude-sonnet-5
metadata:
  version: "1.0.1"
  author: "Agent OS"
  tags: [rhino, grasshopper, rhinocommon, ghpython, geometry, computational-design, architecture]
---

# Skill: Python for Rhino & Grasshopper

## Deep-Load Protocol
Load reference files ONLY when the following conditions are met:

| File | Load When |
|:---|:---|
| `references/api-lookups.md` | Before using any `Rhino.Geometry` or `Grasshopper` member |
| `references/pitfalls.md` | Mandatory before EVERY task — avoids hallucinations and traps |
| `references/architecture.md` | New project setup or questions about structural alignment |
| `references/performance.md` | Object count > 1,000 or performance is a project focus |
\r
## 🛠 Environment & Tooling\r
\r
To ensure type safety and high-rigor geometric validation, the following environment setup is required:\r
\r
- **IntelliSense**: Install `Rhino-stubs` in your virtual environment (`pip install Rhino-stubs`). This is mandatory for external editor development to prevent API hallucinations.\r
- **Headless Testing**: Use `rhinoinside` for E2E geometric testing outside of the Rhino UI (see `rhino-e2e-testing`).\r
- **Version Control**: Never commit `.gh` or `.3dm` files to the main source tree; store them in `assets/` or use Git LFS.

## 🏗 The Computational Pipeline
Follow this pipeline for every geometry task:


### Step 1: Analyze Intent & Domain
Determine the geometric scale and success metrics.
- Is it a **Stadium** (bowl logic, sightlines)?
- Is it a **Facade** (panelization, orientation)?
- Is it **General** (algorithmic utility)?

### Step 2: API Lookup (Requirement Gate)
You are FORBIDDEN from guessing API signatures. Use the protocol below to verify:
```bash
grep_search(Query="M:Rhino.Geometry...", SearchPath="[ABS_PATH]/resources", Includes=["RhinoCommon.xml"])
```
*Note: Cross-check M: (Method) and P: (Property).*

### Step 3: Architecture & Performance Selection
Load `references/performance.md` if the set size exceeds 1,000 objects.
- Decide: Is a `.Dispose()` pattern required? Should we use `Parallel.ForEach`?

### Step 4: Implementation (The Thin Wrapper)
- Implement logic in an **external module** (`src/`).
- Use the GhPython canvas ONLY as a thin caller.

### Step 5: Validation Gate
Run the Review Checklist (see below) and delegate to the **geometry-validator** agent.

---

## 🔀 Domain Modes

| Mode | Emphasis | Typical Operations |
| :--- | :--- | :--- |
| **Stadium** | Precision, Sightlines | C-Value analysis, sectional profile generation |
| **Facade** | Topology, Orientation | Face normal extraction, panel remapping, attractor logic |
| **Landscape** | Mesh Analysis, Grading | Drape operations, slope analysis, RTree proximity |
| **Furniture** | Joinery, Manufacturability | Boolean operations, tolerance handling, nesting |
| **General** | Logic, Data Trees | Custom DataTree structures, algorithmic sorting |

---

## 📖 API Reference Lookups (MANDATORY)

Consult [api-lookups.md](references/api-lookups.md) for the mandatory lookup protocol and the Hallucination Deny List. You are FORBIDDEN from guessing API signatures.

---

## 📋 Code Review Checklist
- [ ] Starts with `#! python 3`?
- [ ] Uses `Rhino.Geometry` (RhinoCommon) over `rhinoscriptsyntax`?
- [ ] **IntelliSense**: `Rhino-stubs` installed in the environment for type hinting?
- [ ] References document tolerance (`doc.ModelAbsoluteTolerance`)?
- [ ] Disposes heavy geometry in loops? (See `references/performance.md`)
- [ ] Unit system validated at entry?
- [ ] Logic > 50 lines extracted to external module?
- [ ] `Parallel.ForEach` considered for performance?
- [ ] Constants defined in `config.py`?
- [ ] `pytest.approx` used for all geometric assertions?
