---
name: python-rhino-grasshopper
description: "Expert in RhinoCommon API, GhPython, and computational design scripting for Rhino 8. Mandates the use of 'Rhino.Geometry' and high-rigor patterns. Use this skill for geometry creation, panelization, structural logic, and Grasshopper data tree management."
tags: [rhino, grasshopper, rhinocommon, ghpython, geometry, computational-design, architecture]
auto_activate: false
argument-hint: "[stadium|facade|landscape|furniture|general] <geometric goal>"
metadata:
  version: "1.0.1"
  author: "Agent OS"
---

# Skill: Python for Rhino & Grasshopper

## Deep-Load Protocol
Load reference files ONLY when the following conditions are met:

| File | Load When |
|:---|:---|
| `references/pitfalls.md` | Mandatory before EVERY task — avoids hallucinations and traps |
| `references/architecture.md` | New project setup or questions about structural alignment |
| `references/performance.md` | Object count > 1,000 or performance is a project focus |

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

> [!CAUTION]
> LLMs frequently hallucinate properties (e.g., `.BoundingBox` vs `.GetBoundingBox()`). You MUST use the **absolute path** to the resources directory in your `grep_search`.

- **Resource Directory**: `skills/python-rhino-grasshopper/resources/` (Resolve to absolute path)
- **Files**: `RhinoCommon.xml`, `Grasshopper.xml`, `GH_IO.XML`

---

## 📋 Code Review Checklist
- [ ] Starts with `#! python 3`?
- [ ] Uses `Rhino.Geometry` (RhinoCommon) over `rhinoscriptsyntax`?
- [ ] References document tolerance (`doc.ModelAbsoluteTolerance`)?
- [ ] Disposes heavy geometry in loops? (See `references/performance.md`)
- [ ] Unit system validated at entry?
- [ ] Logic > 50 lines extracted to external module?
- [ ] `Parallel.ForEach` considered for performance?
- [ ] Constants defined in `config.py`?
- [ ] `pytest.approx` used for all geometric assertions?

## 🚫 Hallucination Guard
If you are unsure of a property, consult `references/pitfalls.md` for the **Hallucination Deny List**.