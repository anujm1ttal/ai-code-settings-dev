---
description: Audit Pi-facing AGENTS.md instructions without invoking the Claude-only plugin
argument-hint: "[path-to-AGENTS.md | --global]"
---

Review `$ARGUMENTS` (**`commands/claude-md.md` successor for Pi**). Resolve an explicit path or nearest project `AGENTS.md`; `--global` means inspect the *source* `Pi-global.md`, not installed user instructions. In the main session capture the target text, size, and relevant Pi context-file precedence; distinguish repo-only content from global guidance, check references and likely stale routes. Then call `pi_role_agent` with `role: "auditor"` for an independent **report first** review with citations, findings and proposed diff. The Pi pilot has no Claude plugin or write-capable auditor: do not invoke any Claude improver and do not edit automatically. Only after **explicit confirmation** may the main session apply approved changes and obtain a fresh separate audit; user-level Pi context still needs its own overwrite approval. Missing target, evidence, or role means INCOMPLETE. No push or deploy.
