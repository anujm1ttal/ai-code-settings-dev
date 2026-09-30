---
name: python-rules
description: Python (host 3.12+ and Rhino ~3.9) implementation rules and runtime matrix. Loads only when a .py/.pyi file or pyproject.toml is touched.
paths: ["**/*.py", "**/*.pyi", "**/pyproject.toml"]
---

# Python

## Runtime Matrix

| Context | Environment | Syntax | Libraries | Logging |
|:---|:---|:---|:---|:---|
| Host | CPython 3.12+ | `list[T]`, `T \| U` | Pydantic, loguru, uv | `loguru` |
| Rhino Internal | CPython 3.9.x | `List[T]`, `Union` | stdlib only | `print()` |
| Rhino.Inside | Host (3.12+) | 3.12+ | rhinoinside, RhinoCommon | `loguru` |

Host modules must stay 3.9-compatible if intended for GH export.

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

## LSP

`pyright-lsp` (Claude Code plugin) is a bare `pyright` PATH lookup — no-ops silently if
`pyright` isn't installed (`hfo1_lsp-os-docs_1`).
