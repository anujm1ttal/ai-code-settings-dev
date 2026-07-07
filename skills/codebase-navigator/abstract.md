# Skill Abstract: Codebase Navigator (L0)

**Purpose**: Interactive codebase explanation and teaching — transfer a working mental model fast, not produce documentation.

**Core Logic**:
- **Tiered Explanation**: 10-second summary → module map (ASCII) → annotated call chain → code spotlight. Stop when the user has enough.
- **Orient First**: Locate entry points (`main`, `README`, `pyproject.toml`/`package.json` scripts) before explaining anything.
- **Q&A Mode**: Find it → state it → show it (annotated) → connect it (callers/return).

**Constraint**: Do NOT use for writing/updating persisted documentation (use `doc-updater`) or for implementing/refactoring code (route to the coder agent).
