---
description: Audit first-party registry cross-references with the read-only Pi auditor
argument-hint: "[source-root]"
---

Audit `$ARGUMENTS` as a registry source tree. The **main session** collects a raw inventory of commands, skills, roles, rules, project-type references, and link targets, including the commands and exit status of mechanical checks. Pass those file paths and the applicable registry standard to `pi_role_agent` with `role: "auditor"`. The child compares the inventory against actual source files and reports mismatches with citations; it cannot execute shell checks or patch registry files. Missing/stale inventory means INCOMPLETE, not a clean bill of health. Treat Claude-only/Gemini paths as historical inputs, not as Pi registry authority; report Pi-native resources separately. If the child route is unavailable, stop. Do not mark task completion without an independent PASS; do not push or deploy.
