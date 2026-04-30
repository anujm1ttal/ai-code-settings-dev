### [2026-03-18] Pattern: Dot-Folder Visibility

**Context**: Searching the codebase for configuration or environment settings.
**Issue**: Search tools (e.g. `grep_search`) typically skip dot-folders (like `.venv`) by default to save resources.
**Solution**: Always use explicit inclusion/exclusion patterns when searching for items that might reside in dot-folders. Do not assume "root search" covers hidden directories.
