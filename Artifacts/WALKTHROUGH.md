# Walkthrough: Git-Based Phase Workflow

The Git-based phase workflow is now integrated into the Agent OS. This ensures that implementation work is isolated on dedicated branches and merged to `main` only after full auditor acceptance.

## Changes Made

### 1. Orchestration Rules Updated
Modified [orchestration.md](file:///c:/Users/44547/source/repos/ai-code-settings/rules/common/orchestration.md) to include:
- A new **Git Phase Branching** section detailing isolation, naming conventions, and merge requirements.
- Updated **Task Lifecycle** diagram showing Git branch initialization and merge points.

### 2. /blueprint Command Updated
Modified [blueprint.md](file:///c:/Users/44547/source/repos/ai-code-settings/commands/blueprint.md) to:
- Add a mandatory **Git Init** step in the "New Project", "New Phase", and "Re-Plan" workflows.
- This ensures the strategist prompts the user to create a branch immediately after Step 0 approval.

### 3. /audit Command Updated
Modified [audit.md](file:///c:/Users/44547/source/repos/ai-code-settings/commands/audit.md) to:
- Add a **Phase Completion & Git Merge** section.
- This instructs the auditor to provide merge and cleanup commands when the final task of a phase is completed.

## Verification Results

- [x] Verified rule consistency via manual audit.
- [x] Confirmed task lifecycle steps match the new workflow.
