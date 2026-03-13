---
name: csharp-grasshopper
description: C# standards for RhinoCommon, Grasshopper plugin development, and .NET best practices. Reference for the coder and auditor agents.
tags: ["csharp", "rhino", "grasshopper", "plugins", "dotnet"]
verbosity_control: "TECHNICAL. Focus on API patterns, disposal, and component architecture. No introductory text."
---

# Skill: C# for Grasshopper & RhinoCommon

## 🏗 Project Structure

### Solution Layout

StadiumTools/
├── StadiumTools.sln
├── src/
│   ├── StadiumTools.Core/                  # Pure logic — no Grasshopper dependencies
│   │   ├── StadiumTools.Core.csproj
│   │   ├── Sightlines/
│   │   │   ├── CValueCalculator.cs
│   │   │   ├── FocalPoint.cs
│   │   │   └── SightlineResult.cs
│   │   ├── Rake/
│   │   │   ├── RakeProfile.cs
│   │   │   └── RowConstraints.cs
│   │   ├── Geometry/
│   │   │   ├── SeatingProxy.cs
│   │   │   └── BoundingBoxCuller.cs
│   │   └── Config/
│   │       └── StadiumConstants.cs
│   └── StadiumTools.GH/                    # Grasshopper components — thin wrappers only
│       ├── StadiumTools.GH.csproj
│       ├── Components/
│       │   ├── CValueComponent.cs
│       │   ├── RakeGeneratorComponent.cs
│       │   └── SeatingCullerComponent.cs
│       ├── Parameters/
│       │   └── SectionParam.cs
│       └── StadiumToolsInfo.cs
├── tests/
│   ├── StadiumTools.Core.Tests/
│   │   ├── StadiumTools.Core.Tests.csproj
│   │   ├── Sightlines/
│   │   │   └── CValueCalculatorTests.cs
│   │   └── Rake/
│   │       └── RakeProfileTests.cs
│   └── StadiumTools.GH.Tests/              # Optional — GH component integration tests
└── docs/
    └── component-guide.md

### Separation Principle
- **Core**: Pure computation logic. No Grasshopper or Rhino UI dependencies. Testable in isolation.
- **GH**: Thin wrapper components that translate between Grasshopper I/O and Core logic.
- **Rule**: If logic can exist without Grasshopper, it belongs in Core. GH components should be under 100 lines.

### Project File Standards
- Target: `net48` for Rhino 7, `net7.0` or `net8.0` for Rhino 8+.
- Enable nullable reference types: `<Nullable>enable</Nullable>`.
- Treat warnings as errors in CI: `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>`.
- Use `Directory.Build.props` for shared settings across projects.

## 📐 RhinoCommon Standards

### API Choice
- **Always**: `Rhino.Geometry` (RhinoCommon) for all geometric operations.
- **Never**: `rhinoscriptsyntax` from C# — it is a Python convenience layer and incurs unnecessary overhead.
- **Avoid**: `Rhino.DocObjects` manipulation during computation. Read document state at entry, operate on geometry in memory, write back only at the final step.

### Tolerances
- Never hardcode tolerance values.
- Read from the active document: `RhinoDoc.ActiveDoc.ModelAbsoluteTolerance`.
- For headless or test scenarios, accept tolerance as a parameter with a sensible default:
  - `double tolerance = RhinoDoc.ActiveDoc?.ModelAbsoluteTolerance ?? 0.001`

### Vectors & Transforms
- Always `Unitize()` vectors before use in translations or projections.
- Use `Transform` objects over manual matrix math — they compose cleanly:
  - `Transform.Translation(vector)`
  - `Transform.Rotation(angle, axis, center)`
  - `Transform.PlaneToPlane(source, target)`
- Validate transforms: check `IsValid` before applying to geometry.

### Geometry Creation
- Return new geometry instances. Never modify input geometry in-place.
- Use factory methods where available:
  - `NurbsCurve.CreateFromPoints()` over manual knot/control-point construction.
  - `Mesh.CreateFromBrep()` over manual face/vertex construction.
  - `Brep.CreateBooleanUnion()` over manual face stitching.
- Validate output: check `IsValid` on all created geometry before returning.

## 🗑 Disposal & Memory Management

### The IDisposable Mandate
- All classes holding RhinoCommon geometry (`Mesh`, `Brep`, `Surface`, `Curve`) must implement `IDisposable`.
- Use `using` statements for geometry with a limited scope:
  - `using var mesh = Mesh.CreateFromBrep(brep, parameters);`
- In large loops, dispose explicitly in a `try/finally` block:
  - Extract required data (vertices, normals, areas) first.
  - Dispose the geometry object.
  - Never reference disposed geometry — extract before disposing.

### Disposal Checklist
- [ ] Every `Mesh`, `Brep`, `Surface` created in a loop is disposed after use?
- [ ] `using` statements on all short-lived geometry?
- [ ] `IDisposable` implemented on classes holding geometry fields?
- [ ] `Dispose()` called in `finally` blocks for exception-safe cleanup?
- [ ] No references to disposed objects after `Dispose()` call?

### Memory Patterns for Large Models
- **Lazy Evaluation**: Generate geometry per-section on demand, not all-at-once for 50k+ seats.
- **Lightweight Proxies**: Use `Point3d`, `BoundingBox`, or `Plane` as stand-ins during analysis. Generate full geometry only for final output.
- **Pooling**: For repetitive geometry (identical seat profiles), create once and transform — don't recreate per instance.
- **Streaming Results**: For operations producing large collections, use `IEnumerable<T>` with `yield return` instead of building full `List<T>` in memory.

## 🦗 Grasshopper Component Standards

### Component Architecture
- Inherit from `GH_Component`.
- One component per file. File name matches component name.
- Override `RegisterInputParams`, `RegisterOutputParams`, and `SolveInstance`.
- Keep `SolveInstance` under 50 lines — delegate to Core library methods.

### Input/Output Registration
- Use descriptive parameter names and descriptions.
- Set appropriate `Access` levels:
  - `GH_ParamAccess.item` for single values.
  - `GH_ParamAccess.list` for flat collections.
  - `GH_ParamAccess.tree` only when branch structure carries meaning.
- Provide sensible defaults where possible.
- Validate all inputs at the top of `SolveInstance` — fail fast with `AddRuntimeMessage`.

### Error Reporting
- Use `AddRuntimeMessage(GH_RuntimeMessageLevel.Error, message)` for failures.
- Use `AddRuntimeMessage(GH_RuntimeMessageLevel.Warning, message)` for recoverable issues.
- Never silently swallow errors — always surface to the Grasshopper canvas.
- Include context in messages: `$"Section {sectionId}: C-Value {cValue}mm below minimum {minCValue}mm"`.

### Data Tree Handling
- Use `GH_Structure<T>` or `DataTree<T>` for tree outputs.
- Define explicit paths with `GH_Path(branchIndices)`.
- Match output tree structure to input tree structure unless the operation fundamentally changes dimensionality.
- Never `Flatten()` inside `SolveInstance` — preserve path hierarchy for downstream components.
- Document expected tree structure in the component description.

### Component Metadata
- Override `ComponentGuid` with a unique, stable GUID. Never change it after release.
- Override `Category` and `SubCategory` for Grasshopper toolbar placement.
- Override `Icon` with a 24x24 bitmap.
- Override `Exposure` to control visibility (`GH_Exposure.primary`, `GH_Exposure.secondary`, etc.).

## 🏎 Performance

### Parallel Processing
- Use `System.Threading.Tasks.Parallel.ForEach` for independent per-section calculations.
- Safe to parallelize:
  - Per-section sightline computation.
  - Per-row rake generation.
  - Per-seat proxy creation.
  - Independent BoundingBox tests.
- NOT safe to parallelize:
  - Operations writing to `RhinoDoc`.
  - Data tree construction (`DataTree<T>` is not thread-safe).
  - Any operation sharing mutable state.
- Use `ConcurrentBag<T>` or `ConcurrentDictionary<K,V>` for collecting parallel results, then convert to `DataTree<T>` on the main thread.

### Spatial Optimization
- **BoundingBox Culling**: Test `BoundingBox.Contains` or `BoundingBox.IsPointInside` before expensive intersection operations.
- **RTree**: Use `Rhino.Geometry.RTree` for spatial indexing on large point sets (50k+ seats).
- **Mesh over Brep**: Prefer mesh-based operations for analysis (faster intersection, lower memory). Use Brep only for final output quality.

### Profiling
- Use `System.Diagnostics.Stopwatch` to time critical sections.
- Log timing results for the `auditor` to evaluate against performance success metrics.
- Target benchmarks:
  - Single section (500 seats): < 100ms.
  - Full bowl (50k seats): < 2 minutes.
  - Interactive GH updates (parameter change): < 5 seconds for visible feedback.

## 🧪 Testing

### Framework
- **Runner**: `xunit` (preferred) or `nunit`. Use with `FluentAssertions` for readable assertions.
- **Structure**: Mirror source layout in test project. One test class per source class.
- **Naming**: `MethodName_Scenario_ExpectedResult` (e.g., `CalculateCValue_PremiumSection_ReturnsAbove90`).

### What to Test
- **Core Logic** (mandatory):
  - C-Value calculations with known inputs → known outputs.
  - Rake profile generation with boundary conditions (first row, last row, accessible row).
  - Geometry creation and validation.
  - Edge cases: zero-length vectors, degenerate geometry, empty collections.
- **GH Components** (optional, integration-level):
  - Input validation catches bad data and reports via `AddRuntimeMessage`.
  - Output tree structure matches expected path hierarchy.

### Testing Without Rhino
- Core logic should be testable without a running Rhino instance.
- Depend on `RhinoCommon` NuGet package for geometry types.
- For tests requiring `RhinoDoc` context, use a test fixture that initializes a headless Rhino instance, or mock the tolerance as a parameter.

### Test Data
- Define known sightline test cases with pre-calculated expected values.
- Store test fixtures as embedded resources or JSON files in the test project.
- Use `[Theory]` / `[InlineData]` (xunit) for parameterized tests across multiple sections or configurations.

## 🔒 Security

- **NuGet Hygiene**: Pin all package versions in `.csproj`. No floating version ranges (`*`, `>=`). Audit for deprecated packages before release.
- **Assembly Trust**: Only load plugin assemblies from known, verified paths. Never dynamically load from user-provided paths or network locations.
- **Serialization**: Never use `BinaryFormatter`. Use `System.Text.Json` with explicit type handling for any serialization needs.
- **Input Validation**: Validate all component inputs in `SolveInstance` before processing. Reject null geometry, empty lists, NaN values, and out-of-range parameters.
- **File Paths**: If components accept file paths, validate against traversal attacks (`..`), absolute paths outside the project directory, and UNC paths.
- **Full security standards**: Reference `security.md`.

## 🚫 Anti-Patterns (Explicit Deny List)
- No `rhinoscriptsyntax` from C# — use RhinoCommon directly.
- No hardcoded tolerances — read from document or accept as parameter.
- No geometry modification in-place — return new instances.
- No undisposed geometry in loops — `using` or `try/finally`.
- No business logic in GH components — delegate to Core.
- No `SolveInstance` over 50 lines — extract to methods or Core.
- No mutable static state — components may run in parallel.
- No `Thread.Sleep` — use async patterns or Grasshopper's scheduling.
- No `BinaryFormatter` — use `System.Text.Json`.
- No `catch (Exception)` without re-throw — handle specific exceptions.
- No `GH_ParamAccess.tree` when `.list` is sufficient — trees add complexity.
- No changing `ComponentGuid` after release — breaks saved definitions.

## 🔨 Preferred Toolchain
- **IDE**: Visual Studio 2022 or JetBrains Rider.
- **SDK**: .NET 4.8 (Rhino 7) or .NET 7/8 (Rhino 8+).
- **Testing**: xunit + FluentAssertions.
- **NuGet Packages**: RhinoCommon (matching Rhino version), Grasshopper (matching version).
- **Build**: `dotnet build` from CLI. MSBuild for CI.
- **Linting**: .editorconfig with C# conventions. Enable `dotnet format` in CI.
- **Analysis**: Enable Roslyn analyzers (`Microsoft.CodeAnalysis.NetAnalyzers`).