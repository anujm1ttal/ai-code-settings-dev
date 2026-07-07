# Skill Abstract: Python Development Patterns (L0)

**Purpose**: Pythonic idioms, typing, and immutability standards for CPython 3.12+ code.

**Core Logic**:
- **Typing**: 100% hint coverage, built-in generics (`list[T]`), `T | None` union syntax.
- **Immutability**: Frozen dataclasses by default; no in-place mutation.
- **Error Handling**: Specific exceptions only, `raise ... from e` chaining, contextual messages.

**Constraint**: Do NOT use for Rhino-internal scripts (CPython ~3.9, stdlib only) — use `python-rhino-grasshopper` instead.
