### [2026-03-18] Pattern: Scan Exclusions

**Context**: Codebase sweeps for tech debt or architectural discovery.
**Issue**: Scanning virtual environments, build artifacts, or AI shadow directories significantly degrades performance and returns noisy results.
**Solution**: Explicitly exclude `venv/`, `.venv/`, `env/`, `dist/`, `build/`, `bin/`, `obj/`, `.git/`, and any shadow AI directories (`.gemini/`, `.claude/`) from all codebase sweeps.
