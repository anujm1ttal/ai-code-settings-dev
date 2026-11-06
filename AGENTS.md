# ai-code-settings — the AI OS source repo

This repo is the **Global Registry** and dev source for the Claude, Codex, and Pi AI OS.
Editing here does **not** change live behavior until the relevant platform's approved release
step. Global conventions are loaded from each platform's deployed instructions; this file
covers only how to work *in this repo*. The Pi source is a pilot, not a live global install.

> Governed by `rules/common/claude-md-standards.md` (project tier: ≤150 lines target).

## Deployment model (three layers)

```
repo source  ──platform-specific approved release──▶  user config  ──load──▶  sessions
```

- **Codex:** edit `Codex-global.md` here → run `scripts/deploy-codex.ps1` when approved →
  new Codex sessions load `~/.codex/AGENTS.md`.
- **`Codex-global.md`** is the deployable global instructions file (→ `~/.codex/AGENTS.md`).
  Edit *that* file to change global OS behavior — **not** this `AGENTS.md`.
- Plugins are **not** copied by the Codex deploy script. Install or import them
  through Codex and review the imported configuration.
- **Claude Code:** `CLAUDE-global.md` → `~/.claude/CLAUDE.md` via the separate `scripts/deploy.sh`.
- **Pi pilot:** `Pi-global.md` is source only; proposed user-level preview/destination is
  `~/.pi/agent/AGENTS.md`. Do **not** overwrite it or deploy Pi without separate approval.
  Pi reads this repository's `AGENTS.md` as local guidance, **not** as a Pi global.
- `GEMINI.md` is intentionally divergent and unmaintained — a stale pre-split mirror for Gemini,
  not deployed. Parity is not tracked; do **not** sync it when `rules/` or `Codex-global.md` change.

## Layout

| Dir / file | What it is |
|:---|:---|
| `Codex-global.md` | Codex global source (→ `~/.codex/AGENTS.md`) |
| `CLAUDE-global.md` | Claude global source (→ `~/.claude/CLAUDE.md`) |
| `Pi-global.md`, `pi/` | Pi global-instruction proposal and pilot source, including read-only background roles and advisory council; current source requires a separate Pi release |
| `agents/` | Agent role definitions (`agents.overview.md` = L1 routing) |
| `rules/common/` | Canonical standards, deployed to `~/.codex/rules/` |
| `skills/` | Core skill source (deploys to `~/.agents/skills/`) |
| `commands/` | Claude workflow references; Codex skill wrappers exist, but Pi-native commands require verification |
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
  `scripts/deploy.sh` and its 6-step validation. Pi source is not live until a
  separately approved Pi-only installation.
- **Global vs repo split.** Global OS sources → `Codex-global.md`, `CLAUDE-global.md`, or
  `Pi-global.md` as appropriate. Repo-only guidance → this file. Never mix them
  (see `rules/common/claude-md-standards.md` §2 for the Claude/Codex precedent).
- **State lives in `Artifacts/`.** This repo follows the same Artifacts discipline it defines;
  never write project state to the shadow `~/.codex/projects/` only.
- **`Artifacts/` is its own private repo [HARD-GATE].** This repo is public; its working notes
  are not. `Artifacts/` is gitignored here and is a **nested git repo** with its own remote
  (`anujm1ttal/ai-code-settings-state`, private). Two consequences:
  1. **Committing here does not back up state.** Claude/Codex sessions that write to
     `Artifacts/` commit and push the private state repo at `/handoff`. **Pi pilot exception
     (user-approved):** `/handoff` updates local state files only; GitHub backup is a separate,
     explicitly authorized action. Until that backup succeeds, report state as **local-only**;
     never imply that a local commit is remotely backed up or invoke a credential helper.
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
- **Pi branches.** `pi-setup` is the Pi integration branch: every Pi phase branches from it and
  merges back to it (`--no-ff`). `pi-setup` is a permanent, Pi-only branch: it is never merged or
  released to `main` (user decision 2026-11-05).
- **Cross-project learnings** stage in `Artifacts/GLOBAL_INBOX.md`; `/graduate` promotes them.

## Pointers

- Deploy checklist & rollback → `DEPLOY.md`
- Full repo overview → `README.md`
- Command/skill cheatsheet → `cheatsheet.md`
- Active work & history → `Artifacts/TODO.md`, `Artifacts/Plans/`, `Artifacts/History/`
