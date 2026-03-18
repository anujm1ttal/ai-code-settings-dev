---
name: coding-style
description: Canonical source for all implementation standards — immutability, file architecture, language-specific patterns, error handling, and domain rules. Takes precedence over standards.md on any implementation detail.
---

# Coding Style

**Precedence**: This file wins over `standards.md` on any implementation detail.

## Immutability (CRITICAL)

Return new state; never mutate in-place.
- **Python**: `@dataclass(frozen=True)`. Comprehensions for new collections.
- **TypeScript**: `readonly`, `as const`. `map`/`filter`/`reduce` over imperative loops.
- **C#**: `readonly struct` or `record`. Return new geometry instances until final Bake.
- **DAX**: `VAR/RETURN` to isolate calculations. No implicit context transitions.

## File Architecture

- **Density**: 200–400 lines typical. Hard cap **800 lines**.
- **Cohesion**: One primary class/feature per file. Domain-organized (`/stadium/seating/`), not type-organized (`/utils/`).
- **Rhino/GH**: Heavy logic in external `.py` modules; GH component = thin wrapper.
- **MCP**: One tool per file. Shared utilities in `common/`.
- **C#**: One class per file. Filename matches class name.

## Boundary Defense

- **TypeScript**: Zod schemas mandatory on all MCP tool inputs.
- **Python**: Pydantic `BaseModel` at system boundaries. Type hints on all public functions.
- **C#**: Data annotations or FluentValidation at component inputs.
- **DAX**: `DIVIDE(n, d, 0)` for all division. `SWITCH(TRUE(), ...)` over nested `IF`.
- **Fail Fast**: Validate types and ranges at function entry. No deep-nesting before catching bad input.
- **Constants**: No magic numbers. Use `config.py` / `constants.ts` / `static class Constants` / parameter table.
  - **Rhino/.NET exception**: Raw integers permitted for unresolvable .NET enums WITH inline comment documenting the mapping.

## Language-Specific Standards

### Python (3.12+)
- **Types**: 100% coverage. `list[T]`, `dict[K, V]`, `T | None` union syntax.
- **Data**: `@dataclass(frozen=True)` for value objects. Pydantic for validated boundaries.
- **Tooling**: `ruff` (lint+format), `pyright` strict, `uv` for deps, `pytest` for testing.
- **Logging**: `loguru` only. Never `print()`. Never stdlib `logging`.
- **Async**: `asyncio.TaskGroup` (3.11+). Always set timeouts on network calls.
- **Full reference**: `skill-python-patterns.md`

### Rhino Python (CPython ~3.9)
Overrides for the constrained Rhino 8 runtime:
- **Shebang**: EVERY script MUST begin with `#! python 3` to target the CPython 3 engine.
- **Types**: `Optional[T]`, `List[T]`, `Dict[K, V]` from `typing`. No union syntax, no lowercase generics.
- **Logging**: `print()` is the only reliable channel. Do not use `loguru` or `logging`.
- **Validation**: No Pydantic. Manual validation with early `return`/`raise`.
- **Enums**: Raw integers with inline comments for nested .NET enum paths.
- **DimStyles**: Use `sc.doc.DimStyles` directly. `DimStyles.Add()` expects string, not object.
- **Imports**: `Rhino`, `Rhino.Geometry`, `scriptcontext as sc`. Avoid `rhinoscriptsyntax` for annotations.
- **Full reference**: `skill-python-rhino.md`

### TypeScript
- **Strict**: `noImplicitAny: true`, `strictNullChecks: true`.
- **Validation**: Zod on all external inputs.
- **Error Codes**: JSON-RPC standard codes for MCP tools.
- **Logging**: `console.error` for debug. `stdout` reserved for JSON-RPC transport.
- **Full reference**: `skill-typescript-mcp.md`

### C#
- **Target**: .NET 6+ / RhinoCommon SDK.
- **Nullability**: `<Nullable>enable</Nullable>`.
- **Disposal**: `IDisposable` on all classes holding geometry/unmanaged resources. `using` statements.
- **Naming**: PascalCase public, `_camelCase` private.
- **Full reference**: `skill-csharp-grasshopper.md`

### DAX
- **Readability**: `VAR` for all intermediates. No inline expressions.
- **Safety**: `DIVIDE(n, d, 0)` — never raw `/`.
- **Logic**: `SWITCH(TRUE(), ...)` over nested `IF`.
- **Forbidden**: Calculated columns in Fact tables → offload to Power Query (M).
- **Full reference**: `skill-dax-modeling.md`

## Domain Standards

### Rhino / Grasshopper
- Prioritize `RhinoCommon` over `rhinoscriptsyntax` for performance.
- Document all tolerances and unit assumptions in file headers.
- Dispose heavy geometry objects in large loops.

### Power BI
- Star Schema enforced. No Fact-to-Fact relationships.
- Disable Auto Date/Time. Use dedicated `DimDate` table.
- Measures over calculated columns. Always.

### MCP
- One tool per file. Clear `inputSchema` with Zod.
- Destructive tools require `[DESTRUCTIVE]` tag and user confirmation.
- `stdout` is sacred — debug logs to `console.error` only.

## Error Handling

- **Specific**: Never catch generic exceptions. Target the exact error type.
- **Context**: Every error message includes the state that caused it.
- **No silent failures**: Log, re-raise, or handle explicitly.
- **Python**: No bare `except:`. Use `raise ... from e`. Use `with` for resources.
- **TypeScript**: Map to JSON-RPC codes (`-32602`, `-32603`). No empty `catch` blocks.
- **C#**: Specific exception types. `finally` for geometry disposal.
- **DAX**: `DIVIDE` safety + `ISBLANK()`/`ISEMPTY()` before aggregations.

## Quality Checklist

- [ ] Immutable — no globals, no in-place mutation, no mutable defaults
- [ ] Size — functions <50 lines, files <800 lines, nesting ≤3 levels
- [ ] Type Safety — 100% hints (Python), strict (TS), nullable (C#)
- [ ] Validation — all entry points defended
- [ ] Error Handling — specific exceptions, chained tracebacks, contextual messages
- [ ] Constants — zero magic numbers
- [ ] Logging — correct channel per language
- [ ] Step 0 Alignment — code achieves strategist's Minimalism goal

## Codebase Scanning & Search

All automated or manual codebase sweeps (e.g., `grep_search`, `find_by_name`, `list_dir` for analysis) MUST adhere to these exclusion rules to prevent noise and performance degradation.

- **Exclusions**: Always skip the following directories:
  - Virtual Environments: `venv/`, `.venv/`, `env/`
  - Build Artifacts: `dist/`, `build/`, `bin/`, `obj/`
  - Version Control: `.git/`
  - AI Shadow Directories: `.gemini/`, `.claude/`
- **Tooling**: When using `grep_search`, use the `Includes` or `Excludes` parameters to enforce these boundaries.