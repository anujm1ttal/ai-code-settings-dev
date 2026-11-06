---
description: Reconcile project state with the work done outside the plan, in the main session
argument-hint: "[scope]"
---

Sync `$ARGUMENTS` in the **main session** on the current real project. Do not dispatch a child; use your own read/shell tools. Never print secrets or run a credential helper.

Never read a state file whole (the read tool silently truncates near 50 KB). Beyond the script use grep or read at most 60 lines, each cut to 160 columns (e.g. `head -60 FILE | cut -c1-160`); do not write search results to Artifacts/Temp just to read them back. Do not load skills for this command, and do not sample BACKLOG beyond the script's output.

1. **Learnings:** read only titles if present, e.g. `cut -c1-160 Artifacts/learnings/HOT.md | head -40`.
2. **Inventory:** start with `node "$HOME/.pi/agent/pi-retained/scripts/sync-facts.mjs"` (or `node scripts/sync-facts.mjs` inside ai-code-settings source). Use its output for inventory, state validation and BACKLOG. Check recent changes as needed.
3. **Deploy parity (ai-code-settings only; otherwise say n/a):** `python scripts/verify_deploy_parity.py`, run from the repo root with a repo-relative path. Report the exit code and the file list. Exit 1 means deployed-ahead content: report it, back-port before any deploy, and never deploy to fix it. Never add licensed files to the public repo.
4. **State validation:** using script facts and bounded targeted checks, compare `Artifacts/TODO.md`, `Artifacts/IMPLEMENTATION_PLAN.md`, `Artifacts/.agent/current_task.md` (freshness, objective matches a TODO task, active files exist) and the head of `Artifacts/DECISION_LOG.md` (newest first; look for unresolved entries). Treat truncation or unparsed formats as unknown, not absence.
5. **BACKLOG:** report the OPEN count and first 3-5 titles from the script when available. Surface only; assign no verdicts.
6. **Classify:** RECONCILED (planned work matches file changes), DRIFT (unplanned changes), STALE (`[-]` with no changes, or no progress for 2+ sessions), MISMATCH (`[ ]` but files suggest done, `[x]` but files changed since, or `current_task.md` names a missing task).
7. **Refresh:** you may rewrite only `Artifacts/.agent/current_task.md` (≤2,000 UTF-8 bytes, `wc -c`) with the validated next step. Propose any other change in chat.

Report: session delta, BACKLOG, deploy parity (exit code), a category/count/items table, health of the five state files, and the recommended next step. Do **not** write `[x]`, edit the TODO, plan or decision log, run project code beyond the specified checks, push, deploy or delete. State **local-only / backup pending** when private `Artifacts/` has unpushed commits.
