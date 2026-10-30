# Pi AI OS — user-level instruction source

`Pi-global.md` is the canonical AI OS registry source. A separately approved Pi-only release installs it at `~/.pi/agent/AGENTS.md`. Do not copy Codex or Claude globals into that destination. A project's own `AGENTS.md` adds local rules; Pi reads context files even when project resources are untrusted.

## Working agreements

- Read the repository's `AGENTS.md` and relevant on-demand skills before changing code or project state. Skills in `~/.agents/skills/` are discoverable in Pi; use `/skill:<name>` when an explicit load is needed. A legacy `/skill:source-command-*` wrapper is **not** proof that a corresponding Pi-native `/command` or isolated agent exists.
- Plan substantial work with measurable checks. For production changes, write a failing test before implementation; verify requested behavior with fresh output. Inspect diffs before committing; never claim tests passed from another session's output.
- In projects using `Artifacts/`, keep state there, not only in a session shadow directory. Keep private project state private: do not add it to a public source repo or cite a specific private file as evidence in public docs.
- The source pilot supports `strategist`, `coder`, report-only `auditor`, read-only `scribe` for `/explain`, and optional read-only `explorer` (`read`, `grep`, `find`, `ls` only), with the extension and private policy loaded. Scribe has no shell/write tools and does not own `/docs`, video scripts or metadata. The extension selects model/thinking/tools, not Markdown `model:`. Templates do not spawn children. Source-only `/council` makes three separately bound read-only strategist/coder/auditor calls on SHA-256-pinned synthetic evidence and a fourth read-only advisory synthesis, not a phase verdict. Claim other specialists only with a supported binding and child trace. Explorer returns cited context only; it cannot mark completion, write state or back up private state.
- Parent reads directly by default; delegate only clearly large read-only scans to Explorer, with at most one batched call per investigation (self-contained, no follow-ups). Parent may inspect targeted files and cited excerpts. Explicit no-child workflows take precedence: `/sync` and `/handoff` are no-child main-session workflows. If Explorer is missing or unavailable, stop and ask; never impersonate it. Parent access and model are not enforced.
- Source jobs: read-only explorer/strategist/auditor; background auditors need a manifest. Max two jobs, one expensive operation including sync/council. Expensive jobs need a budget and rates; not a hard cap.
- The orchestrator runs checks and captures raw output and exit status for the auditor to read. The auditor has no shell, edit, or write tools and cannot independently rerun tests. Where a project's task policy explicitly adopts a report-only auditor, the orchestrator may record its cited PASS as the matching `[x]`; it cannot invent a verdict or edit the auditor's findings. Elsewhere follow that project's task authority rules.
- A tool allowlist or project trust is **not a sandbox**. Pi and its children retain OS access and may inherit credentials. Separate untrusted work and credentials with an actual OS/container boundary where needed.
- Pi `/handoff` updates project state locally and reports backup pending; it does not push or commit on its own. GitHub backup is a separate, explicitly authorized action. Do not deploy, install global resources, or overwrite existing user configuration without explicit authorization for that action. Registry source edits do not change live Claude, Codex, or Pi behavior until each platform's approved release step.

## Pi common-rule routing (Pi-facing summaries)

These Pi-facing **summaries** are not copies or automatic imports of `rules/common/*.md`. This file does not load `rules/common/*.md` into a consuming project; no Claude `paths:` frontmatter provides Pi load-scoping. Inspect the relevant source rule on demand only in this registry; adapt it before using it elsewhere. These mappings apply only when this file is loaded by explicit source preview or a separately approved Pi-only release.

- **architecture**: use domain boundaries and ubiquitous language for names; record project-specific terms in its own glossary, not this public registry.
- **claude-md-standards**: the Pi successor grades `AGENTS.md`, not `CLAUDE.md`; keep project guidance repo-specific (target ≤150 lines, hard cap 250), global guidance cross-project, and state precedence and report proposed changes before editing.
- **coding-style**: smallest scoped change, input validation and immutable state by default; follow the project's language conventions, use a failing test before production edits, and do not infer that Claude `paths:` activates a Pi rule.
- **model-routing**: select only explicitly configured pilot bindings from the private five-model allowlist through `pi_role_agent`; Markdown model frontmatter and Claude Opus/Sonnet/Haiku tiers never select Pi child models.
- **orchestration**: a plan/task grants scope, not completion; strategist proposes, coder implements, report-only auditor issues a cited verdict, and only the project's explicit authority rule permits recording `[x]`. No Claude Agent/Teams API is available in Pi. No implementation, scaffolding or status marking before the user approves the plan; a DRAFT plan or untagged task is not approved, and "go ahead" does not approve a draft.
- **security**: fail closed on missing guard inputs, keep credentials out of tracked files, require confirmation before destructive actions; project trust and tool allowlists are not OS isolation, and auditor children inherit provider credentials.
- **standards**: lead with a recommendation, keep output concise and evidence-linked, ask one user decision at a time, and separate global instructions from repo law; do not assume Claude shadow artifacts or formatters exist in Pi.
- **testing-strategy**: choose the cheapest test that proves the user entry point, retain raw output plus exit status, and supply a presence control for absence claims; the main session produces evidence that the read-only auditor opens, otherwise return INCOMPLETE.

## Platform boundaries

| Platform | Instruction source | Live destination |
|:---|:---|:---|
| Pi | `Pi-global.md` | `~/.pi/agent/AGENTS.md` after a separately approved Pi-only release |
| Codex | `Codex-global.md` | `~/.codex/AGENTS.md`, via the Codex deploy workflow |
| Claude Code | `CLAUDE-global.md` | `~/.claude/CLAUDE.md`, via the Claude deploy workflow |

Do not apply another platform's command syntax, hook event schema, or model-routing metadata to Pi without a verified Pi-native mapping.
