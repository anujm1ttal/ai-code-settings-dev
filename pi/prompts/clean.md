---
description: Preview project hygiene candidates without deleting files until authorized
argument-hint: "[scope]"
---

Clean `$ARGUMENTS` in the **main session**, not an isolated concierge. First identify the project root and current high-rigor evidence policy. **Do not scan, list, or propose** anything under `Artifacts/Evidence/`; it is never a deletion candidate. **Skip the Temp purge candidates while a high-rigor phase is active**; only a stray scan is allowed. Before scanning `Artifacts/Temp/` in ordinary mode, protect any file cited by durable reports or decisions: propose promotion to `Artifacts/Evidence/` and repoint citations before any later purge. List exact transient paths (Temp files, logs, scratch), distinguish tracked source/config/private state from disposable files, and present a **preview** with reasons. Require **explicit confirmation** of the exact candidate paths before any deletion; if no confirmation is present, perform **no deletion** and return the proposal only. Never delete `.git`, `.env`, production source, or user-level Pi/Claude/Codex resources. No push or deploy.
