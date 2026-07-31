# ai-code-settings — the AI OS source repo

This repo is the **Global Registry** and dev source for the Claude Code AI OS. Editing here
does **not** change live behavior until you deploy. The OS's own conventions (agent fleet,
commands, routing, rules) are inherited from the deployed global at `~/.claude/CLAUDE.md` —
they are **not** restated here. This file covers only how to work *in this repo*.

> Governed by `rules/common/claude-md-standards.md` (project tier: ≤150 lines target).

## Deployment model (three layers)

```
ai-code-settings/  ──deploy.sh──▶  ~/.claude/  ──inherited──▶  every project session
   (dev source)                    (production)                (live behavior)
```

- Edit source here → run `bash scripts/deploy.sh` → new sessions load the change.
- **`CLAUDE-global.md`** is the deployable global instructions file (→ `~/.claude/CLAUDE.md`).
  Edit *that* file to change global OS behavior — **not** this `CLAUDE.md`.
- Plugins are **not** copied by deploy.sh; they install via `/plugin marketplace add` +
  `/plugin install` from `.claude-plugin/marketplace.json`.
- `GEMINI.md` is a parallel mirror for Gemini; it is not deployed. Keep it in sync manually.

## Layout

| Dir / file | What it is |
|:---|:---|
| `CLAUDE-global.md` | Deployable global instructions (→ `~/.claude/CLAUDE.md`) |
| `agents/` | Agent role definitions (`agents.overview.md` = L1 routing) |
| `rules/common/` | Canonical standards, deployed to `~/.claude/rules/` |
| `skills/` | On-demand skill modules (`skills.overview.md` = L1 registry) |
| `commands/` | Slash-command procedures (`*.md`, one per command) |
| `optional_plugins/` | Native Claude Code plugins (install via marketplace) |
| `hooks/` | Lifecycle enforcement scripts (see `hooks/README.md`) |
| `templates/` | Project scaffolds + `CLAUDE.md.template` |
| `scripts/` | Dev tooling (deploy, model-routing audit, skill-graph) — not deployed |
| `Artifacts/` | This repo's own project state — **separate private repo**, see Local law |

## Commands

| Task | Command |
|:---|:---|
| Test | `pytest tests/ -v` |
| Deploy to `~/.claude/` | `bash scripts/deploy.sh` (`--skip-tests` to skip pytest) |
| Rule-routing table | `python scripts/model_router.py --table` |
| Verify routing honored | `python scripts/model_routing_audit.py --violations-only` |
| Skill dependency graph | `python scripts/skill_graph_analyzer.py .` |

## Local law (overrides / additions)

- **Deploy is the release step.** No source edit is live until `bash scripts/deploy.sh` runs
  and passes its 6-step validation. Claiming a rule/agent change "done" without deploying is
  incomplete.
- **Global vs repo split.** Global OS instructions → `CLAUDE-global.md`. Repo-only guidance →
  this file. Never mix the two (see `rules/common/claude-md-standards.md` §2).
- **State lives in `Artifacts/`.** This repo follows the same Artifacts discipline it defines;
  never write project state to the shadow `~/.claude/projects/` only.
- **`Artifacts/` is its own private repo [HARD-GATE].** This repo is public; its working notes
  are not. `Artifacts/` is gitignored here and is a **nested git repo** with its own remote
  (`anujm1ttal/ai-code-settings-state`, private). Two consequences:
  1. **Committing here does not back up state.** Any session that writes to `Artifacts/` must
     also `git -C Artifacts commit && git -C Artifacts push` — otherwise that state exists on
     one disk only. `/handoff` owns this step.
  2. **Never `git add` anything under `Artifacts/` to the public repo**, and never relocate
     state out of `Artifacts/` to make it public. The file sets are disjoint by design; that
     is what keeps them from drifting.
  3. **Public docs must not cite an `Artifacts/` path as a source.** `README.md`,
     `CHANGELOG.md`, release notes, and every other tracked file are read by people who
     cannot open it — a citation there is a dead reference. State the evidence *claim*
     ("269 pytest exit 0; deploy 6/6") and stop; the path belongs in the commit body and
     the private state repo. Describing the `Artifacts/` **convention** is fine and
     expected (see `cheatsheet.md`) — this bars pointing at *specific* private files.
- **No third-party licensed content in tracked paths [HARD-GATE].** This repo is public and
  MIT — every tracked file is offered to strangers under terms only its owner can grant. Content
  carrying someone else's license (an `All rights reserved` header, a vendored `LICENSE.txt`)
  must be gitignored and obtained by users from its source, never redistributed here. Precedent:
  `optional_plugins/ms-office/` was 184 Anthropic-licensed files published for ~3 days before
  anyone read the license, which explicitly barred copying, derivative works, and distribution.
- **Cross-project learnings** stage in `Artifacts/GLOBAL_INBOX.md`; `/graduate` promotes them.

## Pointers

- Deploy checklist & rollback → `DEPLOY.md`
- Full repo overview → `README.md`
- Command/skill cheatsheet → `cheatsheet.md`
- Active work & history → `Artifacts/TODO.md`, `Artifacts/Plans/`, `Artifacts/History/`
