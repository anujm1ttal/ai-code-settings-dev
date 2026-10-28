---
description: Independent Pi review of a bounded change against raw test evidence
argument-hint: "<scope> <evidence-path>"
---

Audit `$ARGUMENTS`. Before dispatch, the main session must identify the scope, run applicable checks itself, and save their **raw output and exit status** to a file the child can read. If that evidence is absent or stale, return INCOMPLETE; do not pass a summary as a substitute. Call `pi_role_agent` with `role: "auditor"`, including source paths, expected checks, the raw evidence file path, and the requirement to return PASS/FAIL/INCOMPLETE with citations. The auditor has read-only tools and cannot rerun tests or patch source/tests. Inspect its actual result before recording a verdict; apply `[x]` only where the project's authority rule explicitly allows the orchestrator to transcribe a cited independent PASS. If the extension or private policy is unavailable, stop rather than impersonating an isolated audit. No push or deployment.
