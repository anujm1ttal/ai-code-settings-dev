# Global Learnings Inbox

Cross-project lessons awaiting graduation into global rules, skills, or standards.

**Workflow**: Project sessions append entries here via `/learn --global`. Run `/graduate` in this repo to triage them into the correct files.

---

*Last graduated 2026-07-05 (5 entries from `my_mcp_rhino` → BACKLOG artifact, testing-strategy, systematic-debugging, standards).*

### [2026-07-06] gotcha: rhinoinside.load() defaults to Rhino 7 — always pass the major version
Source: parametric-stadium-bowl-system (Phase 17). The `rhinoinside` pip package signature is `load(rhino_dir_or_major_version = 7, ...)`. On a machine with multiple Rhino versions installed, a bare `load()` silently loads Rhino 7 — no warning. Consequence observed: every Lane A (rhino-marked) test run had loaded Rhino 7 while the project targeted Rhino 8; ModelObject APIs (Rhino 8-only) failures masqueraded as test rot. Rule: always `rhinoinside.load(8)` (or explicit system path); when Lane A behaves strangely on a multi-Rhino machine, verify `Rhino.RhinoApp.Version.Major` BEFORE triaging test failures. Graduation candidates: python-rhino-grasshopper and rhino-e2e-testing skills (runtime-loading sections).

## [END OF GLOBAL INBOX]
