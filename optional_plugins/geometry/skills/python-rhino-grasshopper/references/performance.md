# Rhino Performance & Scaling

> Load this on-demand when working with large data sets, complex meshes, or heavy Grasshopper recomputes.

## 🏎 Memory Management (The Dispose Pattern)

RhinoCommon objects are C++ wrappers. Failing to dispose of them in large loops causes memory leaks and UI freezes.

- **Mandatory Dispose**: `Mesh`, `Brep`, `Surface`, `Curve` (when generated in thousands).
- **Pattern**: Use `try/finally` to guarantee disposal.
- **Lazy Extraction**: Extract your required data (vertices, areas, etc.) into native Python types first, then dispose of the geometry object immediately.

```python
for brep in heavy_collection:
    try:
        # 1. Generate temp geometry
        cut_brep = brep.Split(plane, doc.ModelAbsoluteTolerance)
        # 2. Extract values
        areas.append([b.GetArea() for b in cut_brep])
    finally:
        # 3. Cleanup
        if cut_brep: [b.Dispose() for b in cut_brep]
```

## 📐 Computational Optimization

### BoundingBox Culling
Before performing expensive intersections (`Mesh.Intersect`, `Brep.ClosestPoint`), cull candidates using `BoundingBox.Contains` or `BoundingBox.IsDegenerate`.

### Spatial Indexing (RTree)
For proximity queries across large sets (>10,000 points), use `Rhino.Geometry.RTree` instead of brute-force distance loops.

### Batch Operations
Prefer `Mesh.CreateFromBrep()` on arrays of geometry over individual conversions in loops.

## 🧵 Parallel Processing

Use `System.Threading.Tasks.Parallel.ForEach` for independent geometric calculations.

- **Safe to Parallelize**: Independent analysis, point-in-brep tests, per-element generation.
- **UNSAFE**: Writing to `RhinoDoc`, modifying the Grasshopper canvas, constructing DataTrees.
- **Guard**: Lock shared lists/dictionaries or use concurrent collections.

## 🌳 Data Tree Efficiency

- **Structure**: Match branch structure to the geometric hierarchy. Document path-level mapping.
- **Avoid Flatten**: Never use `tree.Flatten()` inside a loop. This leads to exponential complexity.
- **Profiling**: If a single branch exceeds 10,000 items, split it using sub-paths.
