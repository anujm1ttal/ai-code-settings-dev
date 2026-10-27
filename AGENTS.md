# ai-code-settings — the AI OS source repo

This repo is the **Global Registry** and dev source for the Codex AI OS. Editing here
does **not** change live behavior until you deploy. The OS's own conventions (agent fleet,
commands, routing, rules) are inherited from the deployed global at `~/.codex/AGENTS.md` —
they are **not** restated here. This file covers only how to work *in this repo*.

> Governed by `rules/common/claude-md-standards.md` (project tier: ≤150 lines target).

## Deployment model (three layers)

```
ai-code-settings/  ──deploy-codex.ps1──▶  ~/.codex/  ──inherited──▶  every project session
   (dev source)                    (production)                (live behavior)
```

- Edit Codex source here → run `scripts/deploy-codex.ps1` → new sessions load the change.
- **`Codex-global.md`** is the deployable global instructions file (→ `~/.codex/AGENTS.md`).
  Edit *that* file to change global OS behavior — **not** this `AGENTS.md`.
- Plugins are **not** copied by the Codex deploy script. Install or import them
  through Codex and review the imported configuration.
- `GEMINI.md` is intentionally divergent and unmaintained — a stale pre-split mirror for Gemini,
  not deployed. Parity is not tracked; do **not** sync it when `rules/` or `Codex-global.md` change.

## Layout

| Dir / file | What it is |
|:---|:---|
| `Codex-global.md` | Deployable global instructions (→ `~/.codex/AGENTS.md`) |
| `agents/` | Agent role definitions (`agents.overview.md` = L1 routing) |
| `rules/common/` | Canonical standards, deployed to `~/.codex/rules/` |
| `skills/` | Core skill source (deploys to `~/.agents/skills/`) |
| `commands/` | Workflow references; imported Codex skills provide invocations |
| `optional_plugins/` | Claude plugin source; import into Codex selectively |
| `hooks/` | Claude hook source; Codex hooks require separate review and trust |
| `templates/` | Project scaffolds and `CLAUDE.md.template` |
| `scripts/` | Dev tooling (deploy, model-routing audit, skill-graph) — not deployed |
| `Artifacts/` | This repo's own project state — **separate private repo**, see Local law |

## Commands

| Task | Command |
|:---|:---|
| Test | `pytest tests/ -v` |
| Deploy to `~/.codex/` | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy-codex.ps1` |
| Rule-routing table | `python scripts/model_router.py --table` |
| Verify routing honored | `python scripts/model_routing_audit.py --violations-only` |
| Skill dependency graph | `python scripts/skill_graph_analyzer.py .` |

## Local law (overrides / additions)

- **Deploy is the release step.** Codex guidance is not live until
  `scripts/deploy-codex.ps1` runs. Claude guidance still deploys separately via
  `scripts/deploy.sh` and its 6-step validation.
- **Global vs repo split.** Global OS instructions → `Codex-global.md`. Repo-only guidance →
  this file. Never mix the two (see `rules/common/claude-md-standards.md` §2).
- **State lives in `Artifacts/`.** This repo follows the same Artifacts discipline it defines;
  never write project state to the shadow `~/.codex/projects/` only.
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
