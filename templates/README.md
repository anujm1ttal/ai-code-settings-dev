# Templates

Starter templates for project artifacts.

| Template | Purpose |
|:---|:---|
| `Phase-N-Plan.md.template` | Detailed phase technical design (objectives, file changes, dependencies, hard rules, success metrics). Copy to `Artifacts/Plans/Phase-<N>-Plan.md` at phase start. |
| `Phase-N-TODO.md.template` | Phase-level task tracking. Copy to `Artifacts/Plans/Phase-<N>-TODO.md` at phase start. |
| `CLAUDE.md.template` | Project-tier `CLAUDE.md` starter skeleton, scored against `rules/common/claude-md-standards.md`. Copy to the target repo's root as `CLAUDE.md`. |

## Usage

```bash
cp templates/Phase-N-Plan.md.template Artifacts/Plans/Phase-3-Plan.md
cp templates/Phase-N-TODO.md.template Artifacts/Plans/Phase-3-TODO.md
```

> **Note:** The `project.json` manifest system (project-type/skill templates, `manifest_validator.py`, `/manifest`) was retired. Per-project skill selection is now done with native Claude Code plugins — register the marketplace with `/plugin marketplace add <repo>` and enable per project via `enabledPlugins` in `.claude/settings.json`. See `optional_plugins/index.md`.
