# Registry Health Report: Agent OS

**Date**: 2026-04-30
**Auditor**: Antigravity

## Summary
The global registry is 90% healthy. Most agent and skill links are functional, and project type routing is consistent. However, there is documentation drift in `GEMINI.md` and staleness in the `/learn` command following the recent knowledge registry refactor.

## Findings

### 🔴 CRITICAL: Missing Core Skills/Commands
- **[F-001] Missing `verification-gate` in `GEMINI.md`**: This critical skill is not listed in the main command/skill table, making it less discoverable for agents.
- **[F-002] Missing `/graduate` in `GEMINI.md`**: The graduate command exists and is documented in `orchestration.md`, but is absent from the root `GEMINI.md` reference.

### 🟡 HIGH: Stale Command Logic
- **[F-003] `/learn` refers to legacy structure**: `commands/learn.md` still points to `Artifacts/LEARNINGS.md` instead of the new hierarchical `Artifacts/learnings/` directory.

### 🟡 MEDIUM: Broken References
- **[F-004] Missing `cheatsheet.md`**: `orchestration.md` and `registry-audit.md` reference `Artifacts/cheatsheet.md`, but the file does not exist in the repository.
- **[F-005] Orphaned Learning References**: `agents.overview.md` still lists `LEARNINGS.md` as an output for the concierge, which should be updated to `Artifacts/learnings/`.

## Action Items

- [x] **[TODO-001]** Update `GEMINI.md` to include `/graduate` and `verification-gate`.
- [x] **[TODO-002]** Refactor `commands/learn.md` to support the hierarchical `Artifacts/learnings/` structure.
- [x] **[TODO-003]** Either create `Artifacts/cheatsheet.md` or remove references to it from core rules.
- [x] **[TODO-004]** Update `agents/agents.overview.md` and `agents/concierge.md` to refer to the new learnings registry path.

## Link Integrity Pass
- [x] Agent abstracts linked in `agents.overview.md` exist.
- [x] Skill abstracts linked in `skills.overview.md` exist.
- [x] Project type strings are 100% consistent across canonical files.
