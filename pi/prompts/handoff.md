---
description: Save Pi session state locally and prepare a brief; GitHub backup is separate
argument-hint: "[--lite|--phase]"
---

Handoff `$ARGUMENTS` in the **main session**, not a claimed concierge child. This is a **local-only** state update: no commit, push, deploy, or credential-helper invocation. Select `--lite` for a checkpoint, default for session close, or `--phase` for a phase summary. In the current project's own `Artifacts/`, validate the active TODO/plan and refresh `Artifacts/.agent/current_task.md` (≤2,000 UTF-8 bytes) with task, status, branch, blockers, and a concrete next action; write `Artifacts/HANDOFF_BRIEF.md` with verified changes, test results, open decisions, and next agent/action. Record a genuine architectural decision in `Artifacts/DECISION_LOG.md` when needed. Preserve Evidence and cited Temp files; do not purge or archive anything without its separate safety checks.

**No `[x]` changes** from handoff: completion requires an independent cited auditor PASS under the project's task authority rule. Report the exact files changed and whether private state is **local-only / backup pending**. A **separate, explicitly authorized backup** action owns GitHub sync; never imply that local updates are remotely backed up. This Pi-only contract does not change the existing Claude/Codex `/handoff` procedure.
