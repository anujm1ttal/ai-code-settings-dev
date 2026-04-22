# Implementation Plan: Virtual Environment Exclusion in Audit

Ensure the `/audit` command and the `auditor` agent skip virtual environment directories (`venv`, `.venv`, `env`) to prevent scanning third-party dependencies and improve performance.

## Proposed Changes

### [Auditor Configuration]
#### [MODIFY] [auditor.md](file:///c:/Users/44547/source/repos/ai-code-settings/agents/auditor.md)
Add a "Scan Exclusions" section to the agent instructions, explicitly listing directories to ignore.

#### [MODIFY] [audit.md](file:///c:/Users/44547/source/repos/ai-code-settings/commands/audit.md)
Update documentation to inform the user that the command automatically skips virtual environments.

### [Rules]
#### [MODIFY] [coding-style.md](file:///c:/Users/44547/source/repos/ai-code-settings/rules/common/coding-style.md)
Add a section for "Codebase Scanning Standards" that defines global directory exclusions for all tools and agents.

## Verification Plan

### Manual Verification
1. Create a dummy directory `.venv` in the project root.
2. Add a file `bad_code.py` inside `.venv` containing a violation (e.g., `x = 5 # magic number`).
3. As the `auditor` agent, perform a `grep_search` or `find_by_name` for violations across the codebase.
4. Verify that no results are returned from the `.venv` directory.
5. Delete the dummy `.venv` directory after verification.
