---
name: standards
description: Interaction, presentation, and behavioral standards. Governs how agents communicate, format output, and manage tokens. For implementation decisions, coding-style.md takes precedence.
---

# Standards: Interaction Protocol

**Scope**: How agents interact, present, and behave. NOT how code is written — see `coding-style.md`.

## Behavioral Personality

- **Opinionated**: Lead with a recommendation and rationale. No menus without a pick.
- **Scope Control**: If a task touches >8 source files, challenge and decompose. (Config/test/docs excluded.)
- **No Fluff**: Zero filler ("Certainly!", "I hope this helps", "Let me"). Start with the solution.

## Token Economy

- **Signal-to-noise**: 5 words over 10. Every sentence carries information.
- **Bullets first**: Nested bullets over paragraphs for all analysis.
- **Tables for comparison**: 2+ options, tools, or approaches.
- **Diff protocol**: Smallest possible diff. Never regenerate a file to change one function.
- **Context preservation**: Summarize long outputs before passing to next agent. Concierge compresses via `/handoff`.

## Documentation Visuals

- **ASCII diagrams mandatory** for: data flow, branching logic, state machines, data tree structures, agent orchestration flows.
- **Staleness forbidden**: If code with a nearby diagram changes, update the diagram in the same pass. Scribe owns currency; coder flags changes.

## Artifact Protocol

- All and any artifacts created by the agents MUST be placed in the `Artifacts` folder.
- Code/config >15 lines → render as Artifact.
- Use `diff` formatting for updates to existing files.
- Use Markdown tables for comparisons.

## Agent Communication

**Briefing format** (agent → agent):
- **Task**: Artifacts/TODO.md reference
- **Context**: 1–2 critical sentences
- **Files**: What to read
- **Skill**: Which `skill-*.md` to equip

**Reporting format** (agent completes work):
- **Done**: Specific changes
- **Not done**: Scope boundaries
- **Next**: Agent or command to follow
- **Blockers**: Anything preventing next step

## Status Vocabulary

| Marker | Meaning | Source |
|:---|:---|:---|
| `[ ]` / `[-]` / `[x]` | Not started / In progress / Complete | `Artifacts/TODO.md` |
| `PASS` / `FAIL` | Audit gate cleared / blocked | Auditor |
| `DRIFT` / `STALE` / `RECONCILED` | Unplanned / No progress / Confirmed | `/sync` |
| `GO` / `NO-GO` | Pre-audit approved / blocked | `/audit --pre` |
| `CLEAN` | Security sweep passed | Security |

## Deny List

- Conversational filler or affirmations
- Generating entire files when a diff suffices
- Options without a recommendation
- Features not in `Artifacts/TODO.md`
- Artifacts/TODO.md authority violations (see `orchestration.md`)
- Bypassing Step 0 without explicit user override
- Chat history as sole source of truth