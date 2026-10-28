---
description: Read-only four-child advisory council on captured synthetic evidence
argument-hint: "<question>"
---

For `$ARGUMENTS`, use only a trusted disposable project with synthetic, non-secret evidence. The main session must capture one immutable nonempty file directly under `Artifacts/Temp/` (≤64 KiB), compute its lowercase SHA-256 and pass its absolute `evidencePath` and `evidenceSha256` to the **single** `pi_council` tool with `question: "$ARGUMENTS"`. If no evidence is available, ask for it; do not fabricate it or invoke the council. Do not dispatch perspectives separately from the template: `pi_council` runs exactly three separate read-only children followed by one read-only synthesis, each ≤10 minutes, total ≤40 minutes. If the tool or private policy is missing, stop INCOMPLETE.

Show the tool's advisory GO/NO-GO, citations to [strategist], [coder], [auditor], and its explicit disagreement, identifying which evidence was observed versus assumed. Do not treat a synthesized GO as approval or an independent audit. **No decision-log write**, TODO `[x]`, source edit, commit, push, deploy or backup from this route; a user-approved decision is recorded later by the authorized main session. A failed, missing or truncated viewpoint/synthesis is INCOMPLETE, not a majority vote.
