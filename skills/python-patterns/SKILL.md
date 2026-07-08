---
name: python-patterns
description: Use this skill whenever you are writing, refactoring, or reviewing Python 3.12+ code. It mandates Pythonic idioms (PEP 8), strict type hinting, loguru for logging, and immutability by default. Trigger when you are starting a new Python project, fixing a linting error from ruff, or adding a pydantic model for validation. Do NOT use for Rhino-internal scripts which must follow CPython ~3.9 with stdlib only; refer to python-rhino-grasshopper for specialized Rhino runtime constraints.
argument-hint: "<Python logic requirement or code style question>"
metadata:
  version: "1.2.0"
  tags: ["python", "development", "standards", "backend", "coding-style"]
  globs: ["*.py", "pyproject.toml", "setup.cfg"]
  verbosity_control: "TECHNICAL. Prioritize code blocks over prose. Use high-density bullet points for logic rules."
---


# Skill: Python Development Patterns

## 🐍 Core Principles
- **Readability**: Prioritize clarity over "clever" one-liners.
- **EAFP**: "Easier to Ask Forgiveness than Permission" (use try/except for control flow where idiomatic).
- **Explicit**: Avoid side effects in imports or "magic" behavior.
- **Immutability**: Default to frozen dataclasses and new-collection returns. See `coding-style.md` for the full mandate.

## 🖋 Type Hinting (Python 3.12+)
- Use built-in generics: `list[T]`, `dict[K, V]`, `set[T]`, `tuple[T, ...]`.
- Use union syntax: `T | None` instead of `Optional[T]`.
- Use `type` statement (3.12+) for complex type aliases: `type Vector3D = tuple[float, float, float]`.
- Define `Protocol` classes for duck-typing where structural subtyping is required.
- 100% type hint coverage on all public function signatures. Enforced by `pyright` in strict mode.

## 📝 Naming & Style
- **Constants**: `UPPER_SNAKE` at module level only.
- **Booleans**: Prefix with `is_`, `has_`, `should_`, `can_`.
- **Private**: Single `_prefix` for internal. Never use `__dunder` mangling unless avoiding subclass collision.
- **Avoid abbreviations**: `response` not `resp`, `configuration` not `cfg` — except domain-standard terms (e.g., `idx`, `ctx` in geometry/math contexts).
- **Match/Case**: Use `match`/`case` (3.10+) for multi-branch dispatch instead of `if`/`elif` chains when matching structure or value patterns.

## 🛡 Error Handling
- **Specific**: Never use bare `except:`. Catch specific exceptions (`KeyError`, `ValueError`).
- **Chaining**: Use `raise NewError(...) from e` to preserve tracebacks.
- **Context**: Use `with` statements for all resource management (files, network, DB).
- **Custom Exceptions**: Define project-specific exception hierarchies rooted in a base `ProjectError` class.
- **Messages**: Every error message must include the state that caused it: `f"Failed to compute rake for section {section_id}: {e}"`.

## 🏎 Performance
- **Comprehensions**: Use list/dict comprehensions for simple mapping/filtering.
- **Generators**: Use `yield` or generator expressions for large datasets to save memory.
- **Join**: Use `"".join()` for string concatenation in loops.
- **Slots**: Use `__slots__` on high-frequency objects (e.g., per-seat geometry) to reduce memory overhead.
- **Structural Pattern Matching**: Prefer `match`/`case` over `isinstance` chains for type dispatch.

## 📐 Dataclasses & Models
- Prefer `@dataclass(frozen=True, slots=True)` for value objects (immutability + performance).
- Use `pydantic.BaseModel` for validation at system boundaries (API input, config parsing, file I/O).
- Avoid `NamedTuple` for anything that needs methods or defaults — use dataclasses.
- Use `field(default_factory=list)` — never mutable default arguments.

## 🔀 Async
- Never mix `sync` and `async` I/O in the same call stack without `asyncio.to_thread()`.
- Use `asyncio.TaskGroup` (3.11+) over `gather()` for structured concurrency + cleaner error propagation.
- Always set timeouts on network calls: `async with asyncio.timeout(30):`.
- Use `asyncio.Lock` for shared-state protection in concurrent tasks.

## 🧪 Testing
- **Framework**: `pytest` exclusively. No `unittest`.
- **Naming**: `test_<unit>_<scenario>_<expected>` (e.g., `test_parse_empty_input_raises_valueerror`).
- **AAA**: Arrange → Act → Assert. One logical assertion per test.
- **Fixtures over setUp**: Prefer `pytest` fixtures with explicit scope (`session`, `module`, `function`).
- **No logic in tests**: No loops, no conditionals. Use `@pytest.mark.parametrize` for variants.
- **Mock boundaries, not internals**: Mock I/O (HTTP, DB, filesystem), not your own functions.
- **Coverage**: Aim for >90% on business logic. Exclude boilerplate and configuration from coverage targets.

## 🔧 Logging
- **Library**: `loguru` exclusively. No stdlib `logging`. No `print()`.
- **Structured**: Use `logger.bind(section_id=id).info("Processing section")` for machine-parseable context.
- **Levels**:
  - `DEBUG`: Internal state for development.
  - `INFO`: Operational milestones (task started, completed).
  - `WARNING`: Recoverable issues (fallback used, tolerance relaxed).
  - `ERROR`: Failures that stop a specific operation but not the whole system.
  - `CRITICAL`: System-wide failures requiring immediate attention.
- **Sinks**: Configure file rotation and structured JSON output for production. Console output for development.
- **Never log secrets**: Sanitize all log output. No API keys, tokens, or PII in log messages.

## 🔒 Security Defaults
- Never use `eval()`, `exec()`, or `pickle.loads()` on untrusted input.
- Never use `yaml.load()` — always `yaml.safe_load()`.
- Use `secrets.token_urlsafe()` over `random` for anything auth-related.
- Parameterize all SQL — no f-string queries.
- Validate and sanitize all file paths. Reject `..` traversal.
- Full security standards in `security.md`.

## 📦 Project Structure
- Use `src/` layout for packages (`src/mypackage/`) to avoid import shadowing.
- `__all__` in every `__init__.py` to control public API surface.
- Keep modules < 400 lines. If splitting, group by domain, not by type (not `utils.py`, `helpers.py`).
- Test files mirror source structure: `src/stadium/seating.py` → `tests/stadium/test_seating.py`.

## 🚫 Anti-Patterns (Explicit Deny List)
- No mutable default arguments (`def f(x=[]):`). Use `None` + internal init.
- No `import *`. Ever.
- No nested functions deeper than 1 level (extract to module-level or class).
- No `type: ignore` without a specific error code (`type: ignore[assignment]`).
- No string formatting with `%` or `.format()` — f-strings only.
- No bare `except:` — always specify the exception type.
- No `global` or `nonlocal` — refactor to class or return values.
- No `print()` for operational output — use `loguru`.

## 🔨 Preferred Toolchain
- **Linting/Formatting**: `ruff` (replaces `flake8`, `black`, `isort`).
- **Package Management**: `uv` (replaces `pip`, `poetry`, `pyenv`, `pipx`) — commands and lockfile discipline in §uv Workflow below.
- **Testing**: `pytest` (replaces `unittest`).
- **Type Checking**: `pyright` in strict mode (replaces `mypy`).
- **Logging**: Use `loguru` for all application code. (Note: `loguru` is not available inside internal Rhino Python; use `print()` there).
- **Dialect Boundary**: If writing code intended to run *inside* Rhino 8 (e.g., Grasshopper scripts, Rhino Python scripts), restrict syntax to **Python 3.9** standards:
  - Use `from typing import List, Optional`.
  - Avoid `|` union types; use `Union[T, U]`.
  - Avoid `list[T]` lowercase generics.
- **Validation**: `pydantic` v2 at system boundaries.
- **Data Classes**: `dataclasses` with `frozen=True, slots=True` for internal value objects.

## ⚡ uv Workflow
`uv` owns the full project lifecycle — interpreter, venv, deps, tool invocation. Never mix in `pip install`, `python -m venv`, or bare tool `.exe` launchers.

- **New project**: `uv init --package` (creates `src/` layout per §Project Structure) → edit `pyproject.toml` → `uv sync`.
- **Dependencies**: `uv add <pkg>` / `uv add --dev <pkg>` / `uv remove <pkg>`. `pyproject.toml` is the source of truth — never hand-install into the venv.
- **Lockfile discipline**: `uv.lock` is machine-generated and MUST be committed. Upgrade deliberately via `uv lock --upgrade-package <pkg>`; never delete the lockfile to "fix" resolution.
- **Reproduce**: `uv sync` locally; `uv sync --frozen` in CI — fails loudly on a stale lockfile instead of silently re-resolving.
- **Interpreter**: pin per-project in `.python-version` (e.g. `3.12`); `uv python install` fetches it. No pyenv, no manual installers.
- **Run everything via `uv run`**: `uv run python -m pytest`, `uv run python -m ruff check .`, `uv run python script.py`. Guarantees the project venv without activation AND satisfies `coding-style.md` §Windows Shell & Paths — no `.exe` launchers, no `WinError 6`.
- **One-off tools**: `uvx <tool>` (e.g. `uvx pip-audit`) for tools that shouldn't be project deps; audit per `security.md`.
- **Rhino boundary**: `uv` manages Host-side (CPython 3.12+) projects only. Rhino-internal scripts have no package manager — stdlib only (see Dialect Boundary above).

## ⚠️ Known Gotchas
- **pytest.ini `[tool:pytest]` header is silently inert**: pytest.ini requires the `[pytest]` section header; `[tool:pytest]` is valid only in setup.cfg. With the wrong header, pytest ignores the ENTIRE file — markers, addopts, strict flags — and emits no warning. After any pytest-config change, prove it is live: `pytest --markers` must list your custom markers, and a deliberately unregistered marker must error under `--strict-markers`.
- **Stranded venv (base interpreter uninstalled)**: When `.venv/Scripts/python.exe` won't launch because its base Python was removed, reinstall a matching version (`py install 3.13`) and repoint `home=`/`executable` in `.venv/pyvenv.cfg` instead of deleting the venv. Repointing preserves all installed site-packages (rhinoinside, pinned deps, un-frozen state); rebuild only if the package set is trivially reproducible.