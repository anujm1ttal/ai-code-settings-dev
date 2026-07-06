# Project Note: Global vs Project CLAUDE.md Split

**Category:** project-notes
**Established:** 2026-07-06 (CMD initiative)

## The invariant

There are now **two** CLAUDE.md files in this repo, and they must not be conflated:

- **`CLAUDE-global.md`** — the OS-wide instructions. `deploy.sh` copies this to
  `~/.claude/CLAUDE.md` (loaded in every session, every project). **Edit this to change global
  behavior.**
- **`CLAUDE.md`** (repo root) — this repo's own maintenance guidance. **NOT deployed.** Slim
  (65 lines); describes deploy/test workflow for the OS itself.

Before the split, a single `CLAUDE.md` was deployed verbatim and served both roles (byte-identical
global + project), which is why they drifted conceptually.

## Governance

- Both are governed by `rules/common/claude-md-standards.md` (global-vs-project content split
  table, size caps: project ≤150 lines, global ≤250).
- Audit/update either with the **`/claude-md`** command (thin wrapper over the installed
  `claude-md-improver` plugin, graded against our standard; report-first, edits on confirm).
- New project CLAUDE.md files start from `templates/CLAUDE.md.template`.

## Still open

`GEMINI.md` was **not** split (deferred by user at Step 0); it still holds the old combined
content and is not deployed. Revisit if Gemini parity is wanted.

Related: [[native-plugins-are-the-loader]], [[deploy-stale-after-subsystem-retire]]
