---
description: Challenge a draft plan through the isolated Pi strategist
argument-hint: "<plan-path> [scope]"
---

Grill `$ARGUMENTS`. Require a real draft plan and its Step 0 value, ROI, minimalism, and risk assumptions. Call `pi_role_agent` with `role: "strategist"` and ask for a skeptical review: concrete counterexamples, possible scope deletion, rollback concerns, and 3–5 evidence-seeking questions. The main session asks **one question at a time** and waits for answers. Do not declare `[APPROVED-HARDENED]`, `[REFACTORED]`, or `[ABORTED]` before the interview and evidence review; child output alone is not user approval. If `pi_role_agent` is unavailable, report the missing pilot binding instead of impersonating a strategist. Do not edit the plan, deploy, or push without the relevant approval.
