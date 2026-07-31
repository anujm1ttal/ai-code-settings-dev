# ai-code-settings

**An opinionated operating system for Claude Code.** Role-based agents, canonical
engineering rules, slash-command workflows, and enforcement hooks — installed once into
`~/.claude/` and inherited by every project you open.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What it gives you

| | |
|:---|:---|
| **8 agents** | `strategist`, `coder`, `auditor`, `scribe`, `council`, `creative-director`, `concierge`, `geometry-validator` — each with an explicit capability boundary (who may write what, who may mark work complete) |
| **23 commands** | `/blueprint` `/audit` `/triage` `/handoff` `/sweep` `/council` `/docs` `/explain` … one procedure per file |
| **9 rule files** | Canonical standards for coding style, architecture, security, testing strategy, orchestration, and token economics |
| **15 core skills** | Always-on modules: `systematic-debugging`, `test-driven-development`, `verification-gate`, `codebase-navigator`, `project-planner`, … |
| **6 plugins / 14 skills** | Installed on demand: `geometry` (Rhino/Grasshopper), `pbi-report`, `code-mcp`, `youtube`, `manuscript`, `visual-storytelling` |
| **8 hooks** | Mechanical guardrails — block writes to secrets and binaries, block `rm -rf`/force-push, inject session state, log an audit trail |

> **Not included: Office document skills (`docx`/`pptx`/`xlsx`).** These are Anthropic's, and
> their license bars redistribution, so this repo does not ship them — obtain them from
> Anthropic. A `pptx` project still routes to `creative-director` and `visual-composition` for
> planning, and `pptx-slide-design` (first-party, in `visual-storytelling`) still emits slide
> prompts; only the OOXML renderers are absent.

The premise: **prose rules get rationalized away, mechanical gates don't.** Rules define
the standard; hooks enforce the subset that can be enforced.

---

## Install

**Requirements** — [Claude Code](https://claude.com/claude-code), `bash` (Git Bash on
Windows), Node.js (for hooks), Python 3.12+ (only to run the test suite).

### 1. The OS layer (agents, rules, commands, core skills, hooks)

```bash
git clone https://github.com/anujm1ttal/ai-code-settings.git
cd ai-code-settings
bash scripts/deploy.sh
```

`deploy.sh` runs a 6-step validation and copies `agents/`, `rules/`, `skills/`,
`commands/`, `templates/`, `hooks/` plus `CLAUDE-global.md` (→ `~/.claude/CLAUDE.md`)
into `~/.claude/`. It backs up whatever it replaces — see [DEPLOY.md](DEPLOY.md) for the
checklist and rollback. Use `--skip-tests` to skip the pytest gate.

### 2. Enable the hooks (optional but recommended)

Merge the `hooks` block from [hooks/settings-template.json](hooks/settings-template.json)
into `~/.claude/settings.json`. Paths use `$HOME`, so no editing is needed. Verify with
`/hooks` — you should see 8. Full reference: [hooks/README.md](hooks/README.md).

### 3. Domain plugins (only if you need them)

No clone required — install straight from GitHub:

```
/plugin marketplace add anujm1ttal/ai-code-settings
/plugin install geometry@ai-code-settings
```

Then enable per project, so only the relevant skills consume context:

```json
// my-project/.claude/settings.json
{ "enabledPlugins": ["geometry", "code-mcp"] }
```

Catalog and authoring guide: [optional_plugins/README.md](optional_plugins/README.md).

---

## Using it

Open any project in Claude Code — `~/.claude/` loads automatically.

```
/blueprint     Plan a feature. Requirements interview → phases → Step 0 challenge → branch
/triage        Investigate a bug: root cause before fix, no source edits until approved
/audit         Quality gate — Logic, Style, and Hard Rules. Returns PASS or FAIL with specifics
/handoff       End a session: capture learnings, snapshot state, write a brief for next time
/sweep         Scan the codebase for tech debt, redundancy, and dead references
/council       High-rigor deliberation when a decision is genuinely contested
```

More: [cheatsheet.md](cheatsheet.md) · [sample_prompts.md](sample_prompts.md) ·
[agents/agents.overview.md](agents/agents.overview.md) ·
[skills/skills.overview.md](skills/skills.overview.md)

### The core loop

```
/blueprint ──▶ plan approved ──▶ implement ──▶ /audit ──▶ PASS ──▶ /handoff
   (strategist)   [HARD GATE]      (coder)     (auditor)          (concierge)
                                                  │
                                                FAIL ──▶ back to coder
```

Two ideas do most of the work:

- **Nothing is "done" without evidence.** A claim needs fresh command output redirected to
  a file and cited by path. A summary of a test run is not a test run.
- **One mandatory stop.** No implementation before the plan is approved. After that, work
  runs to completion and halts only for irreversible actions or genuine forks.

---

## How it fits together

```
ai-code-settings/     ← this repo (source + plugin marketplace)
       │ bash scripts/deploy.sh
       ▼
   ~/.claude/         ← production; loaded into every session
       │ auto-load
       ▼
  my-project/         ← .claude/settings.json enables plugins
                        Artifacts/ holds that project's state
```

Sessions always load from `~/.claude/`, never from this repo — so an in-progress edit here
can't break a live session. **Editing source has no effect until you deploy.**

---

## Repository layout

| Path | What it is |
|:---|:---|
| [CLAUDE-global.md](CLAUDE-global.md) | The global instructions → deploys to `~/.claude/CLAUDE.md` |
| [CLAUDE.md](CLAUDE.md) | Guidance for maintaining *this repo* — not deployed |
| [agents/](agents/) | Agent definitions; `agents.overview.md` is the routing map |
| [rules/common/](rules/common/) | Canonical standards, deployed to `~/.claude/rules/` |
| [skills/](skills/) | 15 always-on core skills |
| [commands/](commands/) | One `.md` procedure per slash command |
| [optional_plugins/](optional_plugins/) | 7 installable plugins |
| [hooks/](hooks/) | 8 lifecycle enforcement scripts |
| [templates/](templates/) | Phase plan/TODO and `CLAUDE.md` scaffolds |
| [scripts/](scripts/) | Dev tooling — deploy, routing audit, skill graph. Not deployed |
| [tests/](tests/) | 15 pytest modules validating the registry |

---

## Contributing

```bash
pytest tests/ -v          # must pass before deploying
bash scripts/deploy.sh    # 6-step validated deploy to ~/.claude/
```

- **Change a rule** → edit `rules/common/*.md`, test, deploy.
- **Add a core skill** → create `skills/<name>/SKILL.md` with YAML frontmatter, register it
  in [skills/skills.overview.md](skills/skills.overview.md), test, deploy.
- **Add a plugin skill** → `optional_plugins/<plugin>/skills/<name>/`, then update
  [.claude-plugin/marketplace.json](.claude-plugin/marketplace.json).

Global OS instructions belong in `CLAUDE-global.md`; repo-only guidance in `CLAUDE.md`.
The split is enforced by [rules/common/claude-md-standards.md](rules/common/claude-md-standards.md).

This is a personal system published in the hope it's useful. Issues and PRs are welcome,
but expect opinionated defaults — much of it encodes specific hard-won preferences.

---

## License

[MIT](LICENSE) © Anuj Mittal
