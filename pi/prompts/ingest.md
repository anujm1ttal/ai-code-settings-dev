---
description: Validate and classify manually produced project files without declaring them complete
argument-hint: "<file-or-export>"
---

Ingest `$ARGUMENTS` in the **main session**; no isolated concierge child is configured. Detect geometry/data/script/config format, parse it, validate the schema (required fields and naming) against the project's plan, and compare with an existing TODO task. Record source tool, timestamp/version and destination only when evidenced; do not invent provenance. **Hard Fail** on unparseable content or exposed secrets/local system paths; **do not quote any secret value** in chat, reports, or evidence, and do not stage or publish it. Soft Fail on a parseable mismatch/no planned task; flag DRIFT for the strategist. A valid match may be proposed for coder or report-only auditor review, but **no `[x]`** is written from ingestion alone. Report source, status, validation details, TODO link or DRIFT, and next responsible role. Do not push, deploy, or silently alter source.
