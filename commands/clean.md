---
description: Manually triggers the Hygiene Phase to clean up transient artifacts and stray files.
---

# Command: /clean

Owned by the **concierge**. Performs mid-session project hygiene.

## Execution Sequence

1. **Temp Cleanup**: Delete all files in `Artifacts/Temp/`.
2. **Stray Scan**: Identify files matching transient patterns:
   - `*.tmp`, `*.log`, `npm-debug.log`, `yarn-error.log`.
   - Scratch scripts in the project root not in `.gitignore`.
   - Temporary analysis artifacts in the project root (should have been in `Temp/`).
3. **Propose Deletion**: List identified files and ask for user confirmation.
4. **Execute**: Securely delete confirmed files.

## Rules

- **Safety First**: Never delete `.git/` contents, `.env` files, or any source code files (`.py`, `.ts`, `.md`, etc.) unless they are explicitly in `Artifacts/Temp/` or identified as scratchpads.
- **Verification**: Always list files before deletion.
