---
description: Bounded Pi codebase discovery with explicit roles instead of Claude Teams
argument-hint: "[--registry] [scope]"
---

Sweep `$ARGUMENTS` as a report-first discovery, **no Claude Teams**. If `--registry` is requested, first run the Pi `/registry-audit` route with main-session captured inventory; do not claim it passed when its auditor is INCOMPLETE. Dispatch `pi_role_agent` with `role: "strategist"` for architecture and risks, then an independent `role: "coder"` for redundancy. Use `/skill:doc-updater` for a **main-session documentation** staleness scan because a scribe child is not configured; label that scan as main-session, not an independent specialist. For final quality, call `pi_role_agent` with `role: "auditor"` and give it captured raw check output plus cited source paths; if the evidence or role is unavailable, report INCOMPLETE. Produce a cited `Artifacts/SWEEP_REPORT.md` (private project state); **no automatic TODO edits** or task completion based on discovery alone—propose changes to the plan owner. Run stages sequentially; each child must have a real tool result, not a pretend persona. No push or deploy.
