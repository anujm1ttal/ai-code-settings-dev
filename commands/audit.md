---
description: High-rigor technical review for geometry logic, MCP schema, DAX performance, and C# plugins. Invokes the auditor agent. Supports --pre mode for plan review before implementation.
---

# Command: /audit

This command invokes the **auditor** agent for a cross-domain quality check against Step 0 constraints and technical skills.

## ⚡ Execution Modes

### Default Mode: Post-Implementation Review
Run after the `coder` completes a task or the user finishes manual work.

1. **Project Detection**: Identify the domain (Rhino/GH, TypeScript/MCP, Power BI, C#/Grasshopper, or Manuscript).
2. **Skill Load**: Equip the domain-specific skill file:
   - Python → `skill-python-patterns.md`
   - Rhino/GH → `skill-python-rhino.md`
   - TypeScript/MCP → `skill-typescript-mcp.md`
   - C#/Grasshopper → `skill-csharp-grasshopper.md`
   - DAX/Power BI → `skill-dax-modeling.md`
   - Manuscript → `skill-manuscript-review.md`
3. **Constraint Review**: Evaluate the current state against the Minimalism and Risk mandates from `IMPLEMENTATION_PLAN.md`.
4. **Domain-Specific Scans**: Execute the relevant checks (see below).
5. **Generate Risk Report**: Categorize findings by severity.

### Pre Mode: `/audit --pre`
Run **before** implementation begins to validate the plan itself.

1. **Read** the target task from `TODO.md` and its parent phase in `IMPLEMENTATION_PLAN.md`.
2. **Validate** that the success metric is numeric and verifiable (not "Done" or "Complete").
3. **Check** that dependencies are satisfied — no predecessor tasks still marked `[ ]` or `[-]`.
4. **Flag** ambiguity in the task definition that could cause scope creep during implementation.
5. **Output** a GO / NO-GO recommendation with specific concerns.

## 🔍 Domain-Specific Scans

### 🏗 Rhino / Grasshopper
- Validate data tree paths and structure (no unnecessary `Flatten()` in loops).
- Verify C-Value calculations against thresholds ($C \geq 60mm$ general, $\geq 90mm$ premium).
- Check unit tolerances against `Rhino.RhinoDoc.ActiveDoc.ModelAbsoluteTolerance`.
- Confirm heavy geometry objects are disposed in large loops.
- Verify RhinoCommon usage over `rhinoscriptsyntax`.

### 🛡 TypeScript / MCP
- Validate JSON-RPC 2.0 compliance and error code mapping.
- Verify Zod schemas on all `inputSchema` definitions.
- Check that destructive tools include HitL approval warnings.
- Verify `console.error` for logging (not `console.log` corrupting stdout).
- Validate async error boundaries and timeout usage.

### 📊 Power BI / DAX
- Validate Star Schema integrity (1:Many, no Fact-to-Fact bridging).
- Check for calculated columns in Fact tables (forbidden — offload to Power Query).
- Verify `VAR/RETURN` pattern in all measures.
- Check `DIVIDE(n, d, 0)` usage (no raw division).
- Flag `SUMX`, `AVERAGEX`, `FILTER` on large Fact tables without justification.
- Confirm Auto Date/Time is disabled with dedicated `DimDate`.

### ⚙️ C# / Grasshopper Plugins
- Validate RhinoCommon usage and `IDisposable` compliance.
- Check NuGet dependency hygiene (pinned versions, no deprecated packages).
- Verify `dotnet build` passes cleanly.
- Check for proper input validation at component boundaries.

### 📝 Manuscript (Non-Code)
- Evaluate structural integrity against genre conventions.
- Check character agency (passive protagonist flag).
- Validate pacing against 3-Act or Fichtean Curve.
- Generate `EDITORIAL_LETTER.md` using GLOW / GROW / ROADMAP format.

### 🐍 Python (All Projects)
- Runs in addition to domain scans when Python is involved.
- Check PEP 8 compliance via `ruff check`.
- Verify type hint coverage via `pyright`.
- Flag anti-patterns: bare `except`, mutable defaults, `import *`, nested functions > 1 level.
- Verify `frozen=True` on dataclasses (immutability mandate).
- Confirm Loguru usage (not `print()` or stdlib `logging`).

## 🔴 Severity: CRITICAL (Blocker)
- **Geometry**: Unit mismatches or tolerance gaps breaking downstream structural logic.
- **MCP**: Security flaws (no HitL for destructive tools) or schema violations.
- **Power BI**: Circular dependencies or direct Fact-to-Fact relationships.
- **C#**: Missing `IDisposable` on geometry objects. Build failures.
- **Python**: Bare `except`, `eval()`/`exec()` on untrusted input, hardcoded secrets.
- **Manuscript**: Core premise is unclear or absent.

## 🟡 Severity: HIGH (Optimization Needed)
- **Geometry**: Over-complex data trees slowing Grasshopper computation.
- **MCP**: Missing error handling in async handshakes or missing timeouts.
- **Power BI**: Calculated columns instead of measures. Iterators on large Fact tables.
- **C#**: Deprecated NuGet packages. Missing input validation.
- **Python**: Functions > 50 lines, files > 800 lines, nesting > 3 levels.
- **Manuscript**: Saggy middle, passive protagonist, stakes plateau.

## 🔵 Severity: MEDIUM (Refinement)
- **All**: Deviation from telegraphic naming conventions.
- **All**: Missing Step 0 rationale in file headers.
- **All**: Missing or stale documentation (flag for `scribe`).

## 📋 Example Report

> **Auditor Report: Stadium Bowl Script**
>
> **[CRITICAL]** Tolerance Mismatch
> - **Issue**: Script uses 0.1mm; Project standard is 1.0mm.
> - **Risk**: Geometry fails to join in main Rhino model.
> - **Fix**: Replace hardcoded value with `RhinoDoc.ActiveDoc.ModelAbsoluteTolerance`.
>
> **[HIGH]** Data Tree Overhead
> - **Issue**: Seating proxies grafted at the component level.
> - **Fix**: Simplify paths before seating generation.
>
> **[MEDIUM]** Stale Documentation
> - **Issue**: `README.md` references old sightline formula.
> - **Action**: Flag for `scribe` to update.

## 🔗 Integration
- Run `/audit` after the `coder` agent finishes a task.
- Run `/audit --pre` before the `coder` begins a new task.
- Run `/audit` before you (User) manually implement a new Rhino component.
- The `auditor` is the sole authority for marking `TODO.md` items `[x]` after a passing audit.