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

## The Decision Ladder (Before Writing Any Code)

Apply in order; stop at the first rung that resolves the task:

1. **Does this need to exist?** (YAGNI — skip it if not)
2. **Already in the codebase?** (Reuse it)
3. **Does stdlib cover it?** (Use it)
4. **Does a native platform feature work?** (Use it)
5. **Is there an already-installed dependency?** (Use it)
6. **Can it be one line?** (Write one line)
7. **Only then**: minimum working code.

Never apply laziness to: input validation, error handling that prevents data loss, security, accessibility, or explicit user requirements.

## Surgical Precision (CRITICAL)

- **Adjacent Code Protection**: Do not "improve," refactor, or reformat adjacent code, comments, or logic that is not directly part of the task.
- **Match Style**: Match the existing style, naming conventions, and patterns of the file, even if they differ from your personal preference.
- **Orphan Lifecycle**: Remove imports, variables, or functions that YOUR changes made unused. Do NOT remove pre-existing dead code unless explicitly requested.
- **No Side Quests**: Every changed line must trace directly to a requirement in the current `Artifacts/TODO.md` phase.
- **Git Hygiene**: Never `git add` to render a diff — use `git diff --no-index /dev/null <file>` for untracked files instead. Before any commit, re-stage every path whose status shows `AM` (index differs from working tree); test results attest to the working tree and say nothing about what is staged.

## 🐍 Python Runtime Matrix
| Context | Environment | Syntax | Libraries | Logging |
|:---|:---|:---|:---|:---|
| **Host** | CPython 3.12+ | `list[T]`, `T | U` | Pydantic, loguru, uv | `loguru` |
| **Rhino Internal** | CPython 3.9.x | `List[T]`, `Union` | Standard lib ONLY | `print()` |
| **Rhino.Inside** | Host (3.12+) | 3.12+ | rhinoinside, RhinoCommon | `loguru` |
*Rule: Host modules must remain 3.9-compatible if intended for GH export.*

---

## 🧪 Testing Strategy
All verification must follow the [testing-strategy.md](./testing-strategy.md) rule.
- **Lane Selection**: Use the cheapest lane (Lane B/Pure) that proves the claim.
- **Evidence**: Provide fresh test output or exit codes for every claim.
- **TDD**: Write failing tests in the lowest valid lane before fixing bugs.

---

## 🔧 Language-Specific Standards

### Python (3.12+)
- **Types**: 100% coverage. `list[T]`, `dict[K, V]`, `T | None` union syntax.
- **Data**: `@dataclass(frozen=True)` for value objects. Pydantic for validated boundaries.
- **Tooling**: `ruff` (lint+format), `pyright` strict, `uv` for deps, `pytest` for testing.
- **Logging**: `loguru` only. Never `print()`. Never stdlib `logging`.
- **Async**: `asyncio.TaskGroup` (3.11+). Always set timeouts on network calls.
- **Circular Imports**: Schema/model modules must NOT import from tool-registration or service modules. Use `from __future__ import annotations` and `TYPE_CHECKING` guards for cross-module type hints. Verify with `python -c "import module"` after restructuring.
- **Full reference**: `python-patterns`

### Rhino Python (CPython ~3.9)
Overrides for the constrained Rhino 8 runtime:
- **Shebang**: EVERY script MUST begin with `#! python 3` to target the CPython 3 engine.
- **Types**: `Optional[T]`, `List[T]`, `Dict[K, V]` from `typing`. No union syntax, no lowercase generics.
- **Logging**: `print()` is the only reliable channel. Do not use `loguru` or `logging`.
- **Validation**: No Pydantic. Manual validation with early `return`/`raise`.
- **Enums**: Raw integers with inline comments for nested .NET enum paths.
- **DimStyles**: Use `sc.doc.DimStyles` directly. `DimStyles.Add()` expects string, not object.
- **Imports**: `Rhino`, `Rhino.Geometry`, `scriptcontext as sc`. Avoid `rhinoscriptsyntax` for annotations.
- **Full reference**: `python-rhino-grasshopper`

### TypeScript
- **Strict**: `noImplicitAny: true`, `strictNullChecks: true`.
- **Validation**: Zod on all external inputs.
- **Error Codes**: JSON-RPC standard codes for MCP tools.
- **Logging**: `console.error` for debug. `stdout` reserved for JSON-RPC transport.
- **Full reference**: `typescript-mcp`

### C#
- **Target**: .NET 6+ / RhinoCommon SDK.
- **Nullability**: `<Nullable>enable</Nullable>`.
- **Disposal**: `IDisposable` on all classes holding geometry/unmanaged resources. `using` statements.
- **Naming**: PascalCase public, `_camelCase` private.
- **Full reference**: `python-rhino-grasshopper`

### DAX
- **Readability**: `VAR` for all intermediates. No inline expressions.
- **Safety**: `DIVIDE(n, d, 0)` — never raw `/`.
- **Logic**: `SWITCH(TRUE(), ...)` over nested `IF`.
- **Forbidden**: Calculated columns in Fact tables → offload to Power Query (M).
- **Full reference**: `dax-modeling`

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
- [ ] Post-Schema Test — run `python -m pytest` after any Pydantic model or validation schema change before committing
- [ ] Step 0 Alignment — code achieves strategist's Minimalism goal
- [ ] Seniority Filter — Would a senior engineer say this is overcomplicated or speculative?
- [ ] Decision Ladder — Was reuse/stdlib/native/existing-dependency ruled out before new code was written?

## Codebase Scanning & Search

All automated or manual codebase sweeps (e.g., `grep_search`, `find_by_name`, `list_dir` for analysis) MUST adhere to these exclusion rules to prevent noise and performance degradation.

- **Exclusions**: Always skip the following directories:
  - Virtual Environments: `venv/`, `.venv/`, `env/`
  - Build Artifacts: `dist/`, `build/`, `bin/`, `obj/`
  - Version Control: `.git/`
  - AI Shadow Directories: `.gemini/`, `.claude/`
- **Tooling**: When using `grep_search`, use the `Includes` or `Excludes` parameters to enforce these boundaries.

## Windows Shell & Paths [HARD-GATE]

This OS runs **Windows-only**. Every session has two shells: the **Bash tool** (Git Bash / POSIX `sh`) and the **PowerShell tool** — each takes its own syntax. Assume Windows; do not write Unix-only assumptions into commands or command specs.

- **Bash-tool paths — forward slashes ONLY.** Backslashes are escape chars: `c:\Users\you\src...` collapses to `c:Usersyousrc...` (bash eats `\U`, `\s`, `\4`, …), silently producing wrong paths and **false "not found"** results. For a Windows absolute path in bash write `/c/Users/you/src/...`; better, prefer **repo-relative** paths (`scripts/x.py`).
- **Command specs & docs**: reference files by **repo-relative, forward-slash** path — never a backslash absolute path. An agent copying it into the Bash tool will mangle it.
- **Existence checks in bash**: `test -f path/to/file` (forward slashes), not `ls c:\...`.
- **Python tools**: invoke via `python -m <tool>` (e.g. `python -m pytest`), not the bare `.exe` launcher — Windows launchers raise `WinError 6` on subprocess-spawning code.
- **PowerShell tool**: use PS syntax (`$env:VAR`, `Test-Path`, `Remove-Item`), not POSIX. Do not mix the two shells' syntax in one call.