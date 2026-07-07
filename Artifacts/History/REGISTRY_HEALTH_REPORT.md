# Registry Health Report

**Date**: 2026-05-14
**Status**: 🟢 HEALTHY

## 🚦 Summary
The Agent OS Registry is functional but exhibits documentation drift and ownership inconsistencies between the core orchestration files (`GEMINI.md`, `orchestration.md`) and the implementation files (`commands/`, `agents/`, `skills/`).

---

## 🛠️ Findings

### 1. Skill Integrity
| Issue | Severity | Description |
|:---|:---|:---|
| **Orphaned Skills** | MEDIUM | Several skills exist in `skills/` but are not referenced in the `GEMINI.md` or `orchestration.md` routing tables. |
| **Omitted References** | LOW | `project-planner` and `doc-updater` are missing from primary command/skill tables despite being core functionality. |

**Affected Orphans**:
- `banana-prompt`
- `business-analyst`
- `doc-updater`
- `project-journal`
- `project-planner`
- `rhino-unit-testing`
- `skill-creator`

### 2. Command Integrity
| Issue | Severity | Description |
|:---|:---|:---|
| **Ownership Drift** | MEDIUM | `/council` owner is listed as `concierge/strategist` in `council.md` but as `council` (agent) in `GEMINI.md` and `orchestration.md`. |

**Recommendation**: Update `council.md` to reflect the specialized `council` agent as the primary owner.

### 3. Agent & Artifact Ownership
| Issue | Severity | Description |
|:---|:---|:---|
| **Ownership Conflict** | HIGH | `DECISION_LOG.md` is assigned to `council` in the fleet table but `concierge` in the persistence table of `orchestration.md`. |
| **Frontmatter Drift** | MEDIUM | All agent files in `agents/` are missing the `role:` field in their YAML frontmatter, which is required by the Registry Audit checklist. |

### 4. Link & Registry Sync
| Issue | Severity | Description |
|:---|:---|:---|
| **PROJECT_TYPE Sync** | PASS | `project-planner/SKILL.md` enums are perfectly aligned with `orchestration.md` routing. |
| **Link Integrity** | PASS | All `file:///` links in cheatsheets and rules point to valid local paths. |

---

## 📝 Action Items

- [x] **[TODO-001]** Resolve `DECISION_LOG.md` ownership conflict in `orchestration.md`. — ⏱️ 10min — 🔴 Critical
- [x] **[TODO-002]** Add `role:` field to YAML frontmatter of all files in `agents/`. — ⏱️ 20min — 🟡 Medium
- [x] **[TODO-003]** Synchronize orphaned skills into `GEMINI.md` command/skill tables or routing. — ⏱️ 30min — 🟡 Medium
- [x] **[TODO-004]** Update `/council` ownership in `commands/council.md` to `council` agent. — ⏱️ 5min — 🟡 Medium
