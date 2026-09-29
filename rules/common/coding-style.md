---
name: coding-style
description: Canonical source for all implementation standards — immutability, file architecture, language-specific patterns, error handling, and domain rules. Takes precedence over standards.md on any implementation detail.
---

# Coding Style

**Precedence**: This file wins over `standards.md` on any implementation detail.

## Immutability

Return new state; never mutate in-place. Python: `@dataclass(frozen=True)`, comprehensions.
TypeScript: `readonly`, `as const`, `map`/`filter`/`reduce` over loops. C#: `readonly struct`/
`record`, return new geometry instances until final Bake. DAX: `VAR/RETURN`, no implicit
context transitions.

## File Architecture

Density 200–400 lines typical, hard cap **800**. One primary class/feature per file,
domain-organized (`/stadium/seating/`) not type-organized (`/utils/`). Rhino/GH: heavy logic in
external `.py` modules, GH component is a thin wrapper. MCP: one tool per file, shared utilities
in `common/`. C#: one class per file, filename matches class name.

## Boundary Defense

Zod (TS) / Pydantic `BaseModel` (Python, type hints on all public functions) / data annotations
or FluentValidation (C#) at every system boundary. `DIVIDE(n, d, 0)` for all DAX division,
`SWITCH(TRUE(), ...)` over nested `IF`. Fail fast — validate at function entry, no deep-nesting
before catching bad input. No magic numbers (`config.py`/`constants.ts`/parameter table) —
exception: raw integers for unresolvable .NET enums, WITH an inline comment mapping them.

## Decision Ladder (before writing code)

YAGNI (does this need to exist?) → reuse (already in codebase?) → stdlib → native platform
feature → an already-installed dependency → one line → only then, minimum working code. Never
apply laziness to input validation, data-loss-preventing error handling, security, accessibility,
or explicit user requirements.

## Surgical Precision

Don't reformat or "improve" adjacent code not part of the task. Match the file's existing style
even over personal preference. Remove imports/vars *your* change orphaned; leave pre-existing
dead code alone unless asked. Every changed line traces to the current TODO phase. Git: never
`git add` to render a diff (`git diff --no-index /dev/null <file>` for untracked); before any
commit, re-stage every path showing `AM` status — test results attest to the working tree, not
the index.

## Python Runtime Matrix

| Context | Environment | Syntax | Libraries | Logging |
|:---|:---|:---|:---|:---|
| Host | CPython 3.12+ | `list[T]`, `T \| U` | Pydantic, loguru, uv | `loguru` |
| Rhino Internal | CPython 3.9.x | `List[T]`, `Union` | stdlib only | `print()` |
| Rhino.Inside | Host (3.12+) | 3.12+ | rhinoinside, RhinoCommon | `loguru` |

Host modules must stay 3.9-compatible if intended for GH export.

## Testing

Follow `testing-strategy.md`. Cheapest lane that proves the claim. Fresh test output/exit code
for every claim. TDD: failing test in the lowest valid lane before fixing a bug.

## Language-Specific

- **Python 3.12+**: 100% type coverage, `list[T]`/`T | None`. `@dataclass(frozen=True)` for
  value objects. `ruff`+`pyright` strict+`uv`+`pytest`. `loguru` only, never `print()`/`logging`.
  `asyncio.TaskGroup` with timeouts. Schema/model modules must not import tool-registration or
  service modules — `from __future__ import annotations` + `TYPE_CHECKING` guards; verify with
  `python -c "import module"`. Full reference: `python-patterns`.
- **Rhino Python (~3.9)**: every script starts `#! python 3`. `Optional[T]`/`List[T]`/`Dict[K,V]`
  from `typing`, no union syntax. `print()` only — no `loguru`/`logging`. No Pydantic, manual
  validation with early return/raise. Raw integers + inline comment for nested .NET enums.
  `sc.doc.DimStyles.Add()` expects a string, not an object. Avoid `rhinoscriptsyntax` for
  annotations. Full reference: `python-rhino-grasshopper`.
- **TypeScript**: strict (`noImplicitAny`, `strictNullChecks`), `unknown` over `any`, Zod at
  every boundary. MCP: JSON-RPC error codes, `console.error` for debug (`stdout` is the
  transport). React/web: CSS Modules by default, TanStack Query (never fetch in `useEffect`),
  Vitest+RTL+jsdom, `eslint-plugin-jsx-a11y` = error. Full references: `typescript-mcp`,
  `react-frontend`.
- **C#**: .NET 6+/RhinoCommon, `<Nullable>enable</Nullable>`, `IDisposable`+`using` for geometry/
  unmanaged resources, PascalCase public/`_camelCase` private. Full reference:
  `python-rhino-grasshopper`.
- **DAX**: `VAR` for every intermediate, `DIVIDE` never raw `/`, `SWITCH(TRUE(), ...)` over
  nested `IF`, no calculated columns in Fact tables (offload to Power Query). Star schema, no
  Fact-to-Fact relationships, disable Auto Date/Time (dedicated `DimDate`), measures over
  calculated columns always. Full reference: `dax-modeling`.
- **MCP** (cross-language): one tool per file, Zod/Pydantic `inputSchema`, `[DESTRUCTIVE]` tag +
  user confirmation on destructive tools, `stdout` reserved for transport.
- **Rhino/Grasshopper** (cross-language): `RhinoCommon` over `rhinoscriptsyntax` for
  performance, document tolerances/units in file headers, dispose heavy geometry in loops.

## Error Handling

Never catch generic exceptions — target the exact type. Every error message includes the state
that caused it. No silent failures: log, re-raise, or handle explicitly. Python: no bare
`except:`, `raise ... from e`, `with` for resources. TypeScript: map to JSON-RPC codes
(`-32602`, `-32603`), no empty `catch`. C#: specific exception types, `finally` for geometry
disposal. DAX: `DIVIDE` safety + `ISBLANK()`/`ISEMPTY()` before aggregations.

## Quality Checklist

Immutable · sized (functions <50 lines, files <800, nesting ≤3) · type-safe · validated at
every entry point · specific exceptions with chained tracebacks · zero magic numbers · correct
logging channel · `python -m pytest` after any schema change, before committing · Decision
Ladder actually applied (reuse/stdlib/native ruled out before new code) · would a senior
engineer call this overcomplicated or speculative?

## Codebase Scanning

Skip `venv/`/`.venv/`/`env/`, `dist/`/`build/`/`bin/`/`obj/`, `.git/`, and AI shadow dirs
(`.gemini/`, `.claude/`) in any sweep — use the search tool's include/exclude parameters.

## Windows Shell & Paths [HARD-GATE]

Windows-only. Two shells, two syntaxes — don't mix them. **Bash tool**: forward slashes only
(`/c/Users/you/src/...`) or repo-relative — backslashes are escape chars and silently mangle
paths (`c:\Users\you\src` → `c:Usersyousrc`), producing false "not found" results.
Repo-relative is safest for anything copy-pasted into the Bash tool. `test -f path/to/file`,
not `ls c:\...`. Python: `python -m <tool>` (e.g. `python -m pytest`), never the bare `.exe`
launcher — it raises `WinError 6` on subprocess-spawning code. **PowerShell tool**: PS syntax
(`$env:VAR`, `Test-Path`, `Remove-Item`), never POSIX.
