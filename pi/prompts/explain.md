---
description: Explain a codebase using the existing codebase-navigator skill
argument-hint: "<path-or-question> [depth]"
---

Explain `$ARGUMENTS` through an **isolated, read-only scribe child**. Use `pi_role_agent` with `role: "scribe"` and a bounded task that requests the `codebase-navigator` skill, actual source reads, file/line citations and an audience-appropriate mental model. The child must not edit files, run shell commands or write permanent docs. Inspect its observed role, model/thinking and tool evidence; a prompt mentioning scribe is not proof a child ran. If the extension or private role policy is missing or unavailable, stop rather than impersonating the role. If the navigator skill is missing, stop instead of inventing its guidance.
