# Project Learnings

### [2026-03-18] Pattern: Scan Exclusions
Excluded virtual environments (`venv`, `.venv`, `env`), build artifacts, and AI shadow directories from codebase sweeps to prevent scanning third-party dependencies and improve performance.

### [2026-03-18] Gotcha: PowerShell Redirection Encoding
Creating files via PowerShell redirection (`>`) can result in UTF-16LE encoding, which search tools (ripgrep) may fail to process as text. Use `write_to_file` or explicit `-Encoding utf8`.

### [2026-03-18] Workflow: Dot-Folder Visibility
Search tools (e.g. `grep_search`) typically skip dot-folders (like `.venv`) by default. Explicit inclusion/exclusion patterns are needed for full control.
