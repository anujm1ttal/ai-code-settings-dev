---
description: Save session state locally in the main session; backup is a separate action
argument-hint: "[--lite|--phase]"
---

Handoff `$ARGUMENTS` in the **main session** on the current real project. Do not dispatch a child. Never print secrets or run a credential helper. Tiers: `--lite` (checkpoint: steps 3, 4, 7 flag only), default (session: 1-4, 6, 7), `--phase` (phase gate: all steps).

1. **Learnings:** propose `/learn` candidates from the session; add local entries to `Artifacts/learnings/` only for items the user accepts. Refresh `Artifacts/learnings/HOT.md` dates (default and `--phase`).
2. **Task mining (default and `--phase`):** list uncommitted action items as "Possible Uncommitted Tasks" with the quoted phrase. Add nothing to `Artifacts/BACKLOG.md` or `Artifacts/TODO.md` without the user's confirmation.
3. **State snapshot:** rewrite `Artifacts/.agent/current_task.md` to ≤2,000 UTF-8 bytes (`wc -c`): current state, next action, blockers first; history goes in the brief. Verify TODO markers are accurate. Append an entry to `Artifacts/DECISION_LOG.md` only for a real decision, newest first; never edit older entries.
4. **Compress:** keep active tasks and open questions; drop superseded plans and verbose output.
5. **Hygiene (`--phase`):** archive completed phases to `Artifacts/History/` when `Artifacts/TODO.md` is over 200 lines, and update `Artifacts/History/INDEX.md`. Delete nothing without explicit confirmation.
6. **Brief:** write `Artifacts/HANDOFF_BRIEF.md` (≤16 KiB): tier, summary, completed, in progress, blockers, decisions, state-file health, next session (agent, task, 1-2 sentences of critical context). If `scripts/gate_telemetry.py` exists run it and include its table verbatim.
7. **Report:** list the files changed, blockers and the next action, and state **local-only / backup pending**. Do not commit or push; a separate, explicitly authorized backup action owns any GitHub sync. Make no `[x]` changes (a report-only auditor decides completion), and do not deploy or archive without confirmation.
