# Global Skill Audit Tasks

- [x] [strategist] Phase 1: Structural Inventory — Success: Audit report populated with all skills
    - [x] List all skills and check for `SKILL.md`
    - [x] Verify YAML frontmatter and directory structure
    - [x] Create `Artifacts/SKILL_AUDIT_REPORT.md`
- [x] [coder] Phase 2: Depth & Compliance Analysis — Success: Detailed report on bloat and style
    - [x] Analyze `SKILL.md` line counts
    - [x] Review instruction tone and progressive disclosure
- [x] [auditor] Phase 3: Trigger Optimization — Success: List of recommended description improvements
    - [x] Evaluate "pushiness" and clarity of descriptions
- [x] [concierge] Final cleanup and handoff — Success: All findings documented and walkthrough created
- [x] [coder] Phase 4: Remediation — Success: Bloated skills refactored using Deep-Load Protocol
    - [x] Refactor `docx` skill (Moved API/XML to `references/`)
    - [x] Refactor `business-analyst` skill (Moved templates/guides to `references/`)
    - [x] Refactor `manuscript-review` skill (Moved market/editorial to `references/`)
    - [x] Refactor `xlsx` skill (Moved standards/guides to `references/`)
    - [x] Refactor `skill-creator` skill (Moved testing/optimization to `references/`)

---

# Phase 11: Optional Plugin System for Singleton Skills

**Objective**: Move 12 singleton skills to optional plugins, reducing bootstrap overhead by 15–25%.

**Phases**: 11.1 (Infrastructure, Week 33) → 11.2 (Copy & Validate, Week 34) → 11.3 (Deactivation, Week 35)

## Phase 11.1: Plugin Infrastructure

- [-] [coder] Create `optional_plugins/` directory structure — Success: All category dirs exist with correct hierarchy
- [-] [coder] Write `optional_plugins/plugin_manifest_schema.json` — Success: Schema passes validation against 12 sample YAML files
- [-] [coder] Write `optional_plugins/index.md` (L0 registry overview) — Success: Readable registry index with skill counts
- [-] [coder] Update `scripts/manifest_validator.py` to support V2 schema — Success: Validator accepts both V1 and V2 manifests
- [-] [coder] Write `optional_plugins/README.md` (migration guide) — Success: Clear walkthrough for developers
- [x] [auditor] Validate schema consistency, JSON/YAML syntax, Python code — Success: [AUDIT-PASS] Phase 11.1 complete

## Phase 11.2: Copy & Validate Singletons

- [ ] [coder] Copy 12 singleton skills to `optional_plugins/[category]/[skill]/` — Success: All 12 skills copied, diff against originals is zero
- [ ] [coder] Create `plugin.yaml` for each of 6 categories — Success: All category manifests written and formatted
- [ ] [coder] Create `METADATA.yaml` for each of 12 skills — Success: All skill metadata files complete with required fields
- [ ] [coder] Update 9 project templates with `plugins` key — Success: All `templates/project-*.json` use V2 schema structure
- [ ] [auditor] Validate all YAML syntax and schema compliance — Success: `/audit PASS` for all 18 YAML files
- [ ] [auditor] Spot-check 3 representative skills (youtube-strategy, python-rhino-grasshopper, manuscript-review) — Success: Auditor report noting no structural drift

## Phase 11.3: Deactivation & Rollback Safety

- [ ] [coder] Write `scripts/migrate_skills_to_plugins.py` (idempotent, reversible) — Success: Script runs with `--dry-run`, `--apply`, `--rollback` modes
- [ ] [coder] Write `Artifacts/ROLLBACK_PROCEDURE.md` (step-by-step reversal) — Success: Documented procedure validated on test environment
- [ ] [coder] Test backward compatibility: V1→V2 manifest upgrade on 3 test projects — Success: Auto-upgrade silent and correct; old manifests load unchanged
- [ ] [coder] Run comprehensive test suite: schema validation, plugin discovery, token calculation — Success: All tests pass
- [ ] [auditor] Spot-check integration with `/manifest`, `/sync`, `/audit` workflows — Success: No regressions in core concierge commands
- [ ] [coder] After auditor sign-off: Remove singleton skills from `skills/` — Success: 12 skills moved, `skills/skills.overview.md` updated
- [ ] [concierge] Update CLAUDE.md and MEMORY_ANCHORS with plugin system information — Success: All agent routing references updated
- [ ] [coder] Create git tag `v11.0.0-plugin-system` — Success: Tag pushed to remote

**Verification**:
- [ ] All singleton skills inaccessible from `skills/`; accessible from `optional_plugins/[category]/`
- [ ] `auto_include=true` projects auto-enable plugins for their type
- [ ] Token savings validated: 15%+ reduction for bootstrap on 3 project types
- [ ] Rollback tested and functional
- [ ] No regressions in `/sync`, `/manifest`, `/audit` workflows
