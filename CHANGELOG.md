# Changelog

All notable changes to the Agent OS Skill System will be documented in this file.

## [12.1.0] - 2026-07-31

### Fixed
- **The geometry plugin's RhinoCommon XML gate was unreachable from every consuming project.**
  The documented lookup path resolved against the *consuming project's* cwd, not the skill
  directory, so the anti-hallucination gate that is supposed to stop invented RhinoCommon APIs
  has been silently inert in every install since it shipped. Four candidate path forms were
  probed with a presence control (a real API sentinel that must be found, and a fictional one
  that must not); the two documented forms resolved to nothing. Pointers now use an
  `API_RESOURCES` token defined in the injected `SKILL.md` under a *"substituted at invocation,
  use verbatim"* heading, with read-on-demand `references/` naming the token rather than the
  raw variable — `${CLAUDE_PLUGIN_ROOT}` is **not** substituted in files read on demand, and an
  earlier fix that assumed it was turned a working gate into a false blocker on every healthy
  read.
- **Bundled scripts were invoked by bare relative path** in `rhino-e2e-testing` and
  `pptx-slide-design` — including one literal dev-repo path that cannot resolve outside this
  repository. All first-party sites now address plugin-owned scripts by plugin root.
- **`probe_harness.py`'s document guard failed open.** A mutating probe that declared no
  document hint was allowed to run against whatever document happened to be active. It now
  fails closed: mutating without a hint aborts.
- **Tool-call examples used a `grep_search(Query=…)` signature that does not exist.** Replaced
  with real `Grep(pattern, path, glob)` calls, executed to confirm.

### Added
- **`probe_harness.py`** — a one-off Rhino probe runner that survives the three `rhinocode`
  traps at once: the CLI returns exit 0 *before* the script finishes, its stdout never reaches
  the caller, and a relative script path runs nothing at all. All three look identical to
  success. The harness uses absolute paths, captures output in-script, and writes a terminal
  sentinel the caller polls for.
- **Mutating-probe safety rules.** A probe declares `read-only` or `mutating`; undeclared is
  treated as mutating. A mutating probe gets exactly one invocation — no retry on timeout, no
  retry on an empty report. Retry is the instinctive response to an empty file and is precisely
  wrong: the second dispatch merely buys the first one time to finish, so a "retry that worked"
  can double-apply a mutation.
- **`DEPLOY.md` §"Shipping a plugin change"** — the plugin release order. **A version bump alone
  does not propagate.** `/plugin install` compares against a cached marketplace catalogue; if
  that catalogue predates the bump, the installer concludes the old version is current and
  **silently no-ops while reporting success**. Refresh the marketplace *first*, then reinstall,
  then confirm a new cache directory exists.
- **Documented why a relative `rhinocode` path runs nothing**: an in-process script's
  `os.getcwd()` is Rhino's *install* directory, not the caller's — a directory that cannot
  contain the script. Paths built inside a probe must also use an absolute base.

### Changed
- `geometry` plugin 1.1.0 → **1.3.0**; `visual-storytelling` 2.2.0 → **2.3.0**.
- `strategist` agent granted the `Bash` tool.

> Verification: 270 pytest exit 0; all fixes re-verified from an **installed plugin cache** in a
> real consuming project rather than from this repository, each absence-proof paired with a
> presence control. Propagation is per-project — other projects keep their pinned version until
> individually reinstalled.

## [12.0.1] - 2026-07-28

### Fixed
- **`guard-commands.js` no longer denies commit messages containing `<placeholder>` paths.**
  An angle-bracket placeholder's closing `>` parsed as a redirect operator and the text
  after it as the target, so `C:/Users/<author>/.claude/hooks/*.js` read as a write to a
  `.js` file. This is the second time a commit message describing the guard was denied by
  the guard (the first is recorded inline at `PS_WRITE_TARGET_RE`). Placeholders are now
  stripped before the redirect scan — an operation that can only remove a `>` from the
  scanned string, never add one, so no bypass is opened. A `\w` lookbehind was tried first
  and **rejected**: it fixed the false positive but stopped catching the space-free
  `echo x>module.py` form, trading a false positive for a false negative.

### Added
- **`nudge-handoff.js` detects an unbacked nested state repo.** When `Artifacts/.git`
  exists, `Artifacts/` is its own repo with its own remote and committing the workspace
  backs up none of it. The hook now nags when that repo has uncommitted changes, commits
  ahead of upstream, or no upstream at all. Silent unless `Artifacts/.git` exists, so it
  costs nothing in the ordinary arrangement. Deliberately **not** suppressed by a recent
  `/handoff` — that is a proxy, whereas unpushed state is a measured fact. Extends the
  existing Stop hook rather than adding a fourth, per the three-hook ceiling in
  `hooks/README.md`.
- **`/handoff` step 7.5 — State-Repo Push**, so the documented procedure matches the
  enforcement.

Evidence: 269 pytest exit 0 (13 new tests); `deploy.sh` 6/6; both hooks live-fired from
the deployed `~/.claude/hooks/` across 6 cases, run twice.

## [12.0.0] - 2026-07-28

**First public release.** The repo is now installable by someone who is not its author.

### Added
- **`LICENSE`** — MIT. The repo was public with no license, which left it legally
  all-rights-reserved (readable, but not usable or forkable).
- **README rewritten for a first-time reader**: what it is → install → use → contribute,
  with a requirements list and both install paths (OS layer via `deploy.sh`, plugins via
  the marketplace). Stale counts corrected — 15 core skills, not 9.

### Changed
- **Hook template is now portable.** `hooks/settings-template.json` invoked
  `node "C:/Users/<author>/.claude/hooks/*.js"` for all 8 hooks — on anyone else's machine
  those resolved to nothing and, being fail-open, failed *silently*. Now `$HOME`, which the
  shell expands in hook shell-form on macOS, Linux, Git Bash, and PowerShell alike.
- **Plugin install no longer requires a clone**: `/plugin marketplace add
  anujm1ttal/ai-code-settings` replaces the author's local absolute path in
  `optional_plugins/README.md` and `index.md`.
- **`skills/skills.overview.md`**: 6 abstract links were absolute `file:///c:/Users/…` URLs,
  dead for every reader but one. Now repo-relative.
- **`DEPLOY.md`, `rules/common/coding-style.md`**: author-specific paths genericized.
- **`hooks/README.md`**: documented the `$HOME` expansion; corrected the verification step
  from "7 hooks" to 8.

### Removed
- **Working state is no longer published.** `Artifacts/` (plans, phase reports, decision log,
  learnings, handoff briefs, evidence dumps), root `history/`, `REGISTRY_HEALTH_REPORT.md`,
  and `powershell-command.md` are untracked and gitignored — 11,365 lines of internal notes.
  They remain versioned and backed up in a separate private repo nested at `Artifacts/`, so
  the OS's Artifacts-at-project-root discipline is unchanged. Git history before this release
  is intact and not rewritten.

## [11.1.0] - 2026-07-06

### Added
- **CLAUDE.md standard**: `rules/common/claude-md-standards.md` — canonical quality bar (global-vs-project content split, 6 scored dimensions, 6 anti-patterns, size caps).
- **`CLAUDE-global.md`**: the deployable global instructions, split out from the repo's own `CLAUDE.md`. `deploy.sh` now deploys this file to `~/.claude/CLAUDE.md`.
- **`/claude-md` command**: on-demand audit/update of a CLAUDE.md against the standard (thin wrapper over the installed `claude-md-improver` plugin; report-first).
- **`templates/CLAUDE.md.template`**: starter skeleton for new project CLAUDE.md files.

### Changed
- **Repo `CLAUDE.md` slimmed** (195 → 65 lines) to repo-specific maintenance guidance; global OS content now lives in `CLAUDE-global.md`.
- **`deploy.sh` now deploys `commands/`** (previously hand-synced, which had drifted).

### Fixed
- **`deploy.sh` repaired**: it referenced three files removed in the OSA-2 manifest retirement (`test_manifest_validator_v2.py`, `manifest_validator.py`, `plugin_manifest_schema.json`), leaving it unrunnable since that phase.

## [1.0.0] - 2026-04-15

### Added
- **Subagent Architecture**: Introduced `geometry-validator` specialized agent for high-rigor geometric verification.
- **Skill Versioning**: Applied `metadata.version: "1.0.0"` and `argument-hint` to all 20 skills.
- **Numbered Pipelines**: Implemented structured execution steps in flagship skills (Rhino, DAX, MCP).
- **Gated Reference Loading**: Moved heavy domain knowledge to `references/` directories (Pitfalls, Performance, Architecture) to optimize context window.
- **API Lookup Protocol**: Formulated mandatory `grep_search` patterns for XML documentation to eliminate hallucinations.

### Changed
- **Auditor Discipline**: Updated `auditor.md` to mandate delegation to `geometry-validator` for `Rhino.Geometry` tasks.
- **Refactored `python-rhino-grasshopper`**: Transitioned from monolithic `SKILL.md` to a modular reference system.
- **Standardized Frontmatter**: Unified YAML schema across all skills for improved routing and discovery.

### Fixed
- HALLUCINATION: Corrected common API pattern errors in Rhino and MCP domains through explicit Pitfalls documentation.
