---
description: Reconcile local filesystem, plan, and task state without claiming an isolated concierge
argument-hint: "[scope]"
---

Sync `$ARGUMENTS` in the **main session**; no concierge child is configured. Read local `Artifacts/learnings/HOT.md` when present, then inspect git status/diff, recent changes, active phase TODO/plan, current task marker, latest decision-log entries, and any OPEN backlog headings. Run **deploy parity** only if this is the ai-code-settings source repo and its verifier exists; an exit 1 means deployed-ahead content must be back-ported before any Claude deploy. Distinguish planned work from drift, stale work, and markers mismatched to evidence. Propose changes rather than marking completion: **no `[x]` writes**. Do not modify `IMPLEMENTATION_PLAN.md` or run project code as a sync side effect; read-only inventory/check commands are allowed. Refresh only a validated short current-task pointer if the project's state rules allow it; when the private state push is blocked, report that state is local-only and do not open a credential helper or retry a push. No deployment or public push.
