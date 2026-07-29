---
name: python-rhino-grasshopper
description: "Expert in RhinoCommon API, GhPython, and computational design scripting for Rhino 8. Ships the RhinoCommon, Grasshopper, and GH_IO XML signature databases offline — use it to verify any Rhino/GH member signature instead of guessing, and whenever checking whether a class, method, or property actually exists. Mandates the use of 'Rhino.Geometry', high-rigor patterns, and strict CPython 3.9 compliance. Use this skill whenever writing, refactoring, or reviewing Python code that interacts with the Rhino runtime or Grasshopper SDK. Trigger when the user mentions 'Rhino', 'Grasshopper', 'geometry', 'brep', or asks what a RhinoCommon/Grasshopper API member does. Use whenever implementing structural logic or data tree management. Do NOT use for pure Python math or logic that doesn't depend on Rhino (use rhino-unit-testing instead)."
argument-hint: "[stadium|facade|landscape|furniture|general] <geometric goal>"
model: claude-sonnet-5
metadata:
  version: "1.0.1"
  author: "Agent OS"
  tags: [rhino, grasshopper, rhinocommon, ghpython, geometry, computational-design, architecture]
---

# Skill: Python for Rhino & Grasshopper

## Environment and Paths (substituted at invocation, use verbatim)

- **API_RESOURCES** (offline API signature databases): `${CLAUDE_PLUGIN_ROOT}/skills/python-rhino-grasshopper/resources`

`${CLAUDE_PLUGIN_ROOT}` is substituted **only in this file**, because this file is injected
into context at invocation. Files under `references/` are *read on demand* — a `Read` returns
raw bytes, so the variable arrives there as an uninterpreted literal. That is why those files
refer to **API_RESOURCES** by name and never spell the variable themselves: resolve the token
from this block, then use the resulting absolute path.

**If the value above still contains a literal `${CLAUDE_PLUGIN_ROOT}` when you use it, the
substitution failed: say so and stop. Do not fall back to guessing API signatures** — an
unavailable oracle is a blocker to report, not a licence to hallucinate. (This check applies to
*this* block only. Seeing the literal inside a `references/` file is normal and is not a
failure.)

A relative path (`resources/`, `skills/python-rhino-grasshopper/resources/`) resolves against
the **consuming project's** cwd, finds nothing, and silently disables the gate — verified.

## Deep-Load Protocol
Load reference files ONLY when the following conditions are met:

| File | Load When |
|:---|:---|
| `references/api-lookups.md` | Before using any `Rhino.Geometry` or `Grasshopper` member |
| `references/pitfalls.md` | Mandatory before EVERY task — avoids hallucinations and traps |
| `references/architecture.md` | New project setup or questions about structural alignment |
| `references/performance.md` | Object count > 1,000 or performance is a project focus |
| `references/ghpython-component.md` | Authoring/debugging a GHPython script component itself — `ghenv`, trees, native components, custom draw |
| `references/gh-io-serialization.md` | Reading/writing `.gh`/`.ghx` headlessly (`GH_IO`) — definition-inspection CI tooling, no Rhino required |
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
You are FORBIDDEN from guessing API signatures. This skill ships the RhinoCommon, Grasshopper,
and GH_IO signature databases offline — grep them:
```
Grep(
  pattern="M:Rhino.Geometry...",
  path="<API_RESOURCES>",      # from the Environment and Paths block above
  glob="RhinoCommon.xml",
  output_mode="content"
)
```
*Note: Cross-check M: (Method) and P: (Property).*
*Full protocol and the Hallucination Deny List: `references/api-lookups.md`.*

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
