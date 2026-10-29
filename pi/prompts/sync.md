---
description: Reconcile project state with the work done outside the plan, in the main session
argument-hint: "[scope]"
---

Sync `$ARGUMENTS` in the **main session** on the current real project. Do not dispatch a child; use your own read/shell tools. Never print secrets or run a credential helper.

1. **Learnings:** read `Artifacts/learnings/HOT.md` if present.
2. **Inventory:** `git status --short`, `git diff --name-only HEAD~1`, recent changes; also `git -C Artifacts status --short --branch` when `Artifacts/` is a nested repo.
3. **Deploy parity (ai-code-settings only; otherwise say n/a):** `python scripts/verify_deploy_parity.py`, run from the repo root with a repo-relative path. Report the exit code and the file list. Exit 1 means deployed-ahead content: report it, back-port before any deploy, and never deploy to fix it. Never add licensed files to the public repo.
4. **State validation:** compare `Artifacts/TODO.md`, `Artifacts/IMPLEMENTATION_PLAN.md`, `Artifacts/.agent/current_task.md` (freshness, objective matches a TODO task, active files exist) and the head of `Artifacts/DECISION_LOG.md` (newest first; look for unresolved entries).
5. **BACKLOG:** if `Artifacts/BACKLOG.md` exists, report the OPEN count and the first 3-5 titles. Surface only; assign no verdicts.
6. **Classify:** RECONCILED (planned work matches file changes), DRIFT (unplanned changes), STALE (`[-]` with no changes, or no progress for 2+ sessions), MISMATCH (`[ ]` but files suggest done, `[x]` but files changed since, or `current_task.md` names a missing task).
7. **Refresh:** you may rewrite only `Artifacts/.agent/current_task.md` (≤2,000 UTF-8 bytes, `wc -c`) with the validated next step. Propose any other change in chat.

Report: session delta, BACKLOG, deploy parity (exit code), a category/count/items table, health of the five state files, and the recommended next step. Do **not** write `[x]`, edit the TODO, plan or decision log, run code, push, deploy or delete. State **local-only / backup pending** when private `Artifacts/` has unpushed commits.
