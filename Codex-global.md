# Codex AI OS

This file is deployed to `~/.codex/AGENTS.md`. It provides the shared working
agreements for every Codex CLI project. A project's own `AGENTS.md` adds its
local commands and conventions.

## Source and navigation

- Canonical standards: `~/.codex/rules/common/`. Read the relevant file before
  planning, implementing, reviewing, or changing project state.
- Agent role definitions and routing: `~/.codex/reference/agents/agents.overview.md`.
- Workflow procedures: `~/.codex/reference/commands/`.
- Reusable skills: `~/.agents/skills/`. Invoke a skill with `$skill-name` or let
  Codex select it from the task description.
- Project state belongs in that project's `Artifacts/` directory. Keep private
  project state out of Codex's shadow directories.

## Working lifecycle

1. For substantial new work, use the strategist role and the `project-planner`
   skill to define scope, measurable success, and a short phase plan. Consult
   `reference/commands/blueprint.md`. Minor one-file edits use the Micro-Task
   Protocol in `rules/common/orchestration.md`.
2. The coder implements approved work and records verification evidence. Use
   `test-driven-development` for production code and `systematic-debugging` for
   failures.
3. The auditor reviews evidence and is the only role that marks an
   `Artifacts/TODO.md` item `[x]`. Consult `reference/commands/audit.md`.
4. Use the scribe for documentation changes and the concierge for sync,
   learnings, and handoff.

Follow the full authority, precedence, approval, and conflict rules in
`rules/common/orchestration.md` and `rules/common/standards.md`. User instructions
and Codex platform policy take precedence over repository guidance.

## Codex surface mapping

- Claude `CLAUDE.md` guidance maps to Codex `AGENTS.md`.
- Each Claude command is available as a Codex skill named
  `$source-command-<name>` (for example, `$source-command-audit`). Its original
  procedure is also in `~/.codex/reference/commands/`. Use the skill name in
  Codex; the original bare `/audit`-style names are not Codex commands.
- Custom subagents are configured in `~/.codex/agents/*.toml`. The Codex deploy
  generates all eight with `gpt-6-sol` and each role's reasoning effort. The
  Markdown references in `reference/agents/` retain Claude model metadata for
  Claude Code; they do not select a Codex model.
- Hooks are configured separately in `~/.codex/hooks.json` or `config.toml`.
  Do not assume a copied Claude hook or matcher enforces a rule in Codex.

## Repository-specific boundary

When working inside `ai-code-settings`, follow its root `AGENTS.md`. The source
files here do not change live Codex behavior until the Codex deployment runs.
