# Rhino Geometry Pitfalls & Hallucinations

> Load this on-demand when debugging geometry failures, mesh errors, or resolving API signatures.
> Aligned with Rhino 8 / CPython 3.9 standards.

## 🔧 Common Pitfalls

| Pitfall | Symptom | Fix |
| :--- | :--- | :--- |
| Hardcoded tolerance | Geometry joins fail in different models | Use `doc.ModelAbsoluteTolerance` |
| Flatten in loop | Exponential slowdown on large models | Maintain path hierarchy, flatten only at final output |
| Non-unitized vectors | Unpredictable translation magnitudes | `.Unitize()` before every transform |
| Undisposed meshes | Memory leak, GH freeze on large models | `try/finally` dispose pattern |
| Single-threaded groups | Large models take 10+ minutes | `Parallel.ForEach` on independent groups |
| Fat GH component | Impossible to debug, test, or reuse | Extract to external module, keep GH as thin wrapper |

## 🚫 Common API Hallucinations (DENY LIST)

**NEVER use these properties/methods** — they are common LLM hallucinations. Follow the correction in the "Reality" column.

| Hallucination | Reality | Context |
| :--- | :--- | :--- |
| `obj.BoundingBox` | `obj.GetBoundingBox(True)` | GeometryBase (Curves, Breps, Meshes) |
| `rs.CreateTextStyle()` | Does NOT exist | Use `sc.doc.DimStyles.Add(name)` |
| `GH_Path(i)` | `GH_Path(i, j)` | Always use explicit multi-D paths for DataTrees |
| `doc.DimStyles.Add(obj)` | `doc.DimStyles.Add(string)` | Method only accepts a unique name string |
| `rs.IsTextStyle()` | Does NOT exist | Check `sc.doc.DimStyles.FindName(name)` |

## 🚫 Anti-Patterns

- ❌ `rhinoscriptsyntax` for dimension/annotation styles — limited API, use RhinoCommon.
- ❌ `DimStyles.Add(style_object)` — expects name string, not object.
- ❌ `DimensionStyle.LeaderContentAngleType.Horizontal` — use integer `1`.
- ❌ `str | None` syntax — Rhino Python targets <3.10; use `Optional[str]` from `typing`.
- ❌ `logging.basicConfig()` without explicit file target — output is swallowed by Rhino.
- ❌ Exact float equality in geometry assertions — always use `pytest.approx`.

## ⚠️ Platform Constraints

- **Logging**: `logging.basicConfig()` output is swallowed — use `print()` or file logging with explicit `filename=`.
- **Script Editor**: Command-line options render in the Rhino viewport, not the editor output.
- **Enums**: .NET nested enum paths often fail to resolve in Rhino Python. Use raw integers and document the magic numbers.
