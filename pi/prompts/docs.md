---
description: Audit and update repository documentation with the existing doc-updater skill
argument-hint: "[--internal|--user|--reference|--all] [file]"
---

Docs `$ARGUMENTS` in the **main session**, using `/skill:doc-updater` for *repository* documentation. The pilot has no isolated scribe; do not claim one. Distinguish this Pi `/docs` prompt template from the user-level `/skill:docs` document-connector skill; do not create an external document when the user asked to update repo files. Select `--internal` (README/architecture/developer), `--user` (guides), `--reference` (API/schema/measure), or `--all` sequentially; default is a targeted staleness/coverage scan. **No Claude Teams** and no pretend parallel scribes. Compare source with docs, give a prioritized gap report with citations, then update only the approved file/scope; ask if scope or audience is ambiguous. Documentation-only edits still need fresh verification and independent review where the project's task gate requires it. Do not overwrite user-level Pi context, push, or deploy.
