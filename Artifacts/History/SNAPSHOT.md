# Project Snapshot: ai-code-settings

### 1. Project Metadata
- **Name**: ai-code-settings (Agent OS Global Registry)
- **Version**: 1.2.0 (Hardened)
- **Last Updated**: 2026-04-22
- **Key Dependencies**: None (Shell/Markdown based)
- **Entry Points**: 
  - `GEMINI.md`: Root config for Gemini
  - `CLAUDE.md`: Root config for Claude Code
- **How it's run**: Commands are invoked via `/command` prefixes which trigger specific agents and rules.

### 2. Directory Tree
```text
ai-code-settings/
├── Artifacts/ (68,432 bytes | 12 files)
├── agents/ (4,512 bytes | 6 files)
├── commands/ (42,105 bytes | 16 files)
├── rules/
│   └── common/ (24,312 bytes | 4 files)
└── skills/ (185,421 bytes | 22 skills)
```

### 3. File Inventory Table
| Path | Lines | Purpose | Key exports |
|:---|:---|:---|:---|
| `rules/common/orchestration.md` | 145 | Fleet routing and task lifecycle | Agent roles, Command registry |
| `rules/common/standards.md` | 120 | Interaction and behavioral standards | [HARD-GATE] protocols |
| `commands/snapshot.md` | 65 | Factual codebase reporting | Snapshot sections, Rules |
| `GEMINI.md` | 135 | Gemini-specific session orchestration | Global Command Table |

### 4. RPC / Tool Surface
None (Meta-project).

### 5. Strategy Prompts
None.

### 6. Layer-Name DSL
N/A.

### 7. Security Gates
- **Mirroring Rule [HARD-GATE]**: `standards.md:38-41`. Mandates physical persistence of brain artifacts.
- **Absolute Path Requirement**: `orchestration.md:89-91`. Prevents shadow directory collisions.

### 8. Configuration & Environment
N/A.

### 9. Logging
N/A.

### 10. TODO / FIXME / HACK / XXX
| File:Line | Tag | Comment |
|:---|:---|:---|
| `orchestration.md:133` | TODO | Parallel execution patterns (empty) |

### 11. Dependencies Between Modules
- `GEMINI.md` → `rules/common/*`
- `orchestration.md` → `commands/*`
- `commands/snapshot.md` → `rules/common/standards.md`

### 12. Tests
N/A.

### 13. Known Pain Points
- `skills/python-rhino-grasshopper/SKILL.md`: 842 lines (>500 lines limit).

### 14. Git State
- **Branch**: main
- **Last Commit**: `306a5fc` feat(standards): harden artifact mirroring and persistence rules
- **Status**: 12 uncommitted changes (new files, modified rules).

### 15. Open Questions
- Should `/snapshot` output to `Artifacts/SNAPSHOT.md` or a timestamped version by default?
