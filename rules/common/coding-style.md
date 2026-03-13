---
name: coding-style
description: Strict technical standards for code architecture, immutability, error handling, and language-specific patterns. Takes precedence over standards.md for all implementation decisions.
---

# Coding Style: Antigravity Standards

**Precedence**: If `coding-style.md` and `standards.md` conflict on any implementation detail, `coding-style.md` wins. `standards.md` governs interaction and presentation only.

## 💎 Immutability & Functional Purity (CRITICAL)
**ALWAYS** return new state; **NEVER** mutate existing objects in-place.
- **Python**: Use `dataclasses` with `frozen=True`. Use list/dict comprehensions to generate new collections.
- **TypeScript**: Use `readonly` modifiers and `as const` assertions. Prefer `map`/`filter`/`reduce` over imperative loops.
- **C#**: Use `readonly struct` or `record` types where possible. Return new geometry instances from transformation methods.
- **Rhino**: When transforming geometry, return new instances rather than modifying `RhinoDoc` objects until the final "Bake" step.
- **DAX**: Use `VAR/RETURN` to isolate intermediate calculations. Never rely on implicit context transitions.
- **Rationale**: Eliminates side effects in complex geometric loops, data streams, and async chains.

## 📁 File & Module Architecture
**Atomic Files > Monoliths**:
- **Density**: 200–400 lines typical. Hard cap at **800 lines**.
- **Cohesion**: One primary class or feature-set per file.
- **Structure**: Organize by **Domain** (e.g., `/stadium/seating/`) rather than **Type** (e.g., `/scripts/`, `/utils/`).
- **Rhino/GH**: Extract heavy logic into external `.py` modules; keep the GH component as a thin wrapper.
- **MCP**: One tool per file. Shared utilities in a `common/` directory.
- **C#**: One class per file. Match filename to class name.

## 🛡️ Boundary Defense & Validation
**Zero-Trust Entry Points**:
- **TypeScript**: Zod schemas mandatory for all MCP tool inputs.
- **Python**: Pydantic `BaseModel` at system boundaries (API input, config parsing, file I/O). Type hints on all public functions.
- **C#**: Data annotations or FluentValidation at component input parameters.
- **DAX**: `DIVIDE(n, d, 0)` for all division. `SWITCH(TRUE(), ...)` over nested `IF`.
- **Fail Fast**: Validate types and ranges at the start of every function. No deep-nesting before catching bad input.
- **Constants**: No "Magic Numbers." Define domain constants in a dedicated location:
  - Python: `config.py` or `constants.py`
  - TypeScript: `constants.ts`
  - C#: `static class Constants` or `appsettings.json`
  - DAX: Dedicated parameter table
  - **Rhino/.NET Exception**: When nested .NET enum paths fail to resolve at runtime, raw integers are permitted WITH an inline comment documenting the enum mapping (e.g., `# 1 = Horizontal, see DimensionStyle.LeaderContentAngleType`).

## 🔧 Language-Specific Standards

### Python (3.12+)
- **Type Hints**: 100% coverage on all public function signatures. Use `list[T]`, `dict[K, V]`, `T | None` (3.10+ union syntax).
- **Dataclasses**: `@dataclass(frozen=True)` for value objects. Pydantic `BaseModel` for validated boundaries.
- **Formatting**: `ruff` for linting and formatting. No legacy tools (`black`, `flake8`, `isort`).
- **Type Checking**: `pyright` in strict mode.
- **Package Management**: `uv` for dependency resolution and virtual environments.
- **Testing**: `pytest` with fixtures. See `skill-python-patterns.md` for full testing standards.
- **Logging**: `loguru` for all operational output. Never `print()`. Never stdlib `logging`.
- **Async**: `asyncio.TaskGroup` (3.11+) for structured concurrency. Always set timeouts on network calls.
- **Full patterns**: Reference `skill-python-patterns.md` for comprehensive Python standards.

### Rhino Python (CPython ~3.9, Rhino 8)
Rhino embeds a constrained Python runtime. The following overrides apply **only** to scripts targeting Rhino/RhinoPython:
- **Type Hints**: Use `Optional[T]`, `List[T]`, `Dict[K, V]` from `typing`. Do NOT use union syntax (`T | None`) or lowercase generics (`list[T]`) — Rhino Python targets pre-3.10.
- **Logging**: `print()` is the only reliable output channel (renders to Rhino command line and script editor output panel). `loguru` and stdlib `logging` output is swallowed. File-based `logging.basicConfig(filename=...)` is permitted as a fallback.
- **Validation**: Pydantic is unavailable. Use manual validation at function entry points with early `return` or `raise`.
- **Enums**: Nested .NET enum paths often fail to resolve. Use raw integers with mandatory inline comments documenting the mapping.
- **DimStyles API**: `rhinoscriptsyntax` has no text/dimension style support. Use `sc.doc.DimStyles` directly. `DimStyles.Add()` expects a string name, not a style object.
- **Imports**: Use `Rhino`, `Rhino.Geometry`, `scriptcontext as sc`. Avoid `rhinoscriptsyntax` for any annotation/dimension operations.
- **Full patterns**: Reference `skill-python-rhino.md` for Rhino-specific conventions and pitfalls.

### TypeScript
- **Strict Mode**: `noImplicitAny: true`, `strictNullChecks: true` in `tsconfig.json`.
- **Validation**: Zod schemas on all external inputs.
- **Error Codes**: Map to JSON-RPC standard codes for MCP tools.
- **Logging**: `console.error` for debug logs to avoid corrupting `stdout` in MCP servers.
- **Full patterns**: Reference `skill-typescript-mcp.md` for MCP-specific standards.

### C#
- **Target**: .NET 6+ / RhinoCommon SDK.
- **Nullability**: Enable nullable reference types (`<Nullable>enable</Nullable>`).
- **Disposal**: Implement `IDisposable` on all classes holding geometry or unmanaged resources. Use `using` statements.
- **Naming**: PascalCase for public members, `_camelCase` for private fields.
- **Full patterns**: Reference `skill-csharp-grasshopper.md` for Rhino/GH-specific standards.

### DAX
- **Readability**: `VAR` for all intermediate calculations. No inline expressions.
- **Safety**: `DIVIDE(n, d, 0)` — never raw `/` operator.
- **Logic**: `SWITCH(TRUE(), ...)` over nested `IF` statements.
- **Forbidden**: Calculated columns in Fact tables. Offload to Power Query (M).
- **Full patterns**: Reference `skill-dax-modeling.md` for modeling and optimization standards.

## 🚦 Error Handling

### All Languages
- **Specific**: Never catch generic exceptions. Target the exact error type.
- **Context**: Every error message must include the state that caused it (e.g., `Error calculating rake for Section {id}: {error}`).
- **No Silent Failures**: Never swallow exceptions. Log, re-raise, or handle explicitly.

### Python
- No bare `except:`. Catch `KeyError`, `ValueError`, etc.
- Use `raise NewError(...) from e` to preserve tracebacks.
- Use `with` statements for all resource management.

### TypeScript
- Map errors to JSON-RPC codes: `-32602` (Invalid Params), `-32603` (Internal Error).
- Use `try/catch` with typed error handling. Never `catch(e) {}` with empty blocks.

### C#
- Use specific exception types (`ArgumentNullException`, `InvalidOperationException`).
- Never catch `System.Exception` at the top level without re-throwing.
- Use `finally` blocks for geometry disposal in Rhino operations.

### DAX
- `DIVIDE(n, d, 0)` handles division safety.
- Use `ISBLANK()` and `ISEMPTY()` checks before aggregations on potentially empty tables.

## ✅ The "Antigravity" Quality Checklist
Before an agent submits code to the **auditor**, it must pass:

- [ ] **Immutable**: No `global` variables, no in-place mutations, no mutable default arguments.
- [ ] **Size**: Functions < 50 lines. Files < 800 lines.
- [ ] **Nesting**: Maximum 3 levels of indentation. If 4+, refactor to sub-function.
- [ ] **Type Safety**: 100% type hint coverage (Python), strict mode (TS), nullable enabled (C#). *Rhino Python: use `typing` module, not union syntax.*
- [ ] **Validation**: All entry points defended with Pydantic/Zod/DataAnnotations. *Rhino Python: manual validation with early return/raise.*
- [ ] **Error Handling**: Specific exceptions, chained tracebacks, contextual messages.
- [ ] **Constants**: Zero magic numbers. All domain values in config/constants. *Rhino/.NET: raw integers permitted for unresolvable enums with inline comment.*
- [ ] **Logging**: Loguru (Python), console.error (TS), structured logging (C#). No `print()`. *Rhino Python: `print()` is the correct output channel.*
- [ ] **Documentation**: Docstrings follow the `scribe` density rules (no fluff).
- [ ] **Step 0 Alignment**: Code achieves the Minimalism goal set by the `strategist`.