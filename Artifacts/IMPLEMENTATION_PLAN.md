# Git-Based Phase Workflow Implementation

This plan integrates a Git branching strategy into the Agent OS lifecycle. Each project phase will operate on its own branch, which is merged into `main` only after full auditor acceptance.

## Proposed Changes

### [Rules] rules/common/orchestration.md
- Add "Git Phase Branching" section under "Task Lifecycle".
- Update the "Task Lifecycle" ASCII diagram/list to include Git branch creation and merge points.
- Define naming convention for phase branches: `phase-[N]-[short-slug]`.

### [Commands] commands/blueprint.md
- Add a mandatory step in "New Project", "New Phase", and "Re-Plan" to create the Git branch after the roadmap is defined and Step 0 is approved.

### [Commands] commands/audit.md
- Add a section for "Phase Completion".
- When the final task of a phase is marked `[x]`, the `auditor` triggers a merge of the phase branch into `main`.

## Verification Plan

### Automated Tests
- Run `/registry-audit` to ensure all rules and commands are consistent.

### Manual Verification
- Simulate starting a new phase with `/blueprint` and verify the instruction to create a branch is present.
- Simulate phase completion and verify the instruction to merge is present.
