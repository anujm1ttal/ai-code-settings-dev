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

- [x] [coder] Create `optional_plugins/` directory structure — Success: All category dirs exist with correct hierarchy
- [x] [coder] Write `optional_plugins/plugin_manifest_schema.json` — Success: Schema passes validation against 12 sample YAML files
- [x] [coder] Write `optional_plugins/index.md` (L0 registry overview) — Success: Readable registry index with skill counts
- [x] [coder] Update `scripts/manifest_validator.py` to support V2 schema — Success: Validator accepts both V1 and V2 manifests
- [x] [coder] Write `optional_plugins/README.md` (migration guide) — Success: Clear walkthrough for developers
- [x] [auditor] Validate schema consistency, JSON/YAML syntax, Python code — Success: [AUDIT-PASS] Phase 11.1 complete

## Phase 11.2: Copy & Validate Singletons

- [x] [coder] Copy 12 singleton skills to `optional_plugins/[category]/[skill]/` — Success: All 12 skills copied, diff against originals is zero
- [x] [coder] Create `plugin.yaml` for each of 6 categories — Success: All category manifests written and formatted
- [x] [coder] Create `METADATA.yaml` for each of 12 skills — Success: All skill metadata files complete with required fields
- [x] [coder] Update 9 project templates with `plugins` key — Success: All `templates/project-*.json` use V2 schema structure
- [x] [auditor] Validate all YAML syntax and schema compliance — Success: `/audit PASS` for all 18 YAML files
- [x] [auditor] Spot-check 3 representative skills (youtube-strategy, python-rhino-grasshopper, manuscript-review) — Success: Auditor report noting no structural drift
- [x] [coder] Fix PLUGIN_REGISTRY sync: Add `powerbi-report` to `pbi-core.skills` in `scripts/manifest_validator.py` line 53 — Success: manifest_validator.py --list-plugins correctly lists powerby-report; all 30 tests PASS
- [x] [auditor] Re-verify Phase 11.2 gates after fix (commit caab6d7) — Success: [AUDIT-PASS] · [ZERO-ISSUES]

## Phase 11.3: Deactivation & Rollback Safety

- [x] [coder] Write `scripts/migrate_skills_to_plugins.py` (idempotent, reversible) — Success: Script runs with `--dry-run`, `--apply`, `--rollback` modes
- [x] [coder] Write `Artifacts/ROLLBACK_PROCEDURE.md` (step-by-step reversal) — Success: Documented procedure validated on test environment
- [x] [coder] Test backward compatibility: V1→V2 manifest upgrade on 3 test projects — Success: Auto-upgrade silent and correct; old manifests load unchanged
- [x] [coder] Run comprehensive test suite: schema validation, plugin discovery, token calculation — Success: All 46 tests pass (100% pass rate)
- [x] [auditor] Spot-check integration with `/manifest`, `/sync`, `/audit` workflows — Success: Gate 4 PASS; no regressions in core concierge commands
- [x] [coder] After auditor sign-off: Remove singleton skills from `skills/` — Success: 13 skills removed, `skills/skills.overview.md` updated
- [x] [concierge] Update CLAUDE.md and MEMORY_ANCHORS with plugin system information — Success: All agent routing references updated
- [x] [coder] Create git tag `v11.0.0-plugin-system` — Success: Commit 1d1859ebcd95b3fa6847482899de26e12858e5ec, tag created (local)

**Verification**:
- [x] All singleton skills inaccessible from `skills/`; accessible from `optional_plugins/[category]/`
- [x] `auto_include=true` projects auto-enable plugins for their type
- [x] Token savings validated: 15–25% reduction for bootstrap on 1–2 plugin projects
- [x] Rollback tested and functional (migration_state.json saved, --rollback mode ready)
- [x] No regressions in `/sync`, `/manifest`, `/audit` workflows

---

## Phase 11.3 Remediation (Blocking Issues)

> [!CRITICAL]
> These tasks MUST be completed before running migration --apply

- [x] [coder] Resolve Issue 1: Add business-analyst to optional_plugins and PLUGIN_REGISTRY
  - Decide on plugin category (new plugin or existing)
  - Copy skill files to optional_plugins/[category]/business-analyst/
  - Update PLUGIN_REGISTRY in manifest_validator.py
  - Verify with `--list-plugins`
  - Success: python -c "from scripts.manifest_validator import PLUGIN_REGISTRY; assert 'business-analyst' in [s for p in PLUGIN_REGISTRY.values() for s in p.get('skills', [])]"

- [x] [coder] Resolve Issue 2: Add cd-foundations to SINGLETON_SKILLS in migration script
  - Edit line 39 of scripts/migrate_skills_to_plugins.py
  - Add "cd-foundations" to the list (alphabetically sorted)
  - Run --dry-run to verify all 12 skills are ready for migration
  - Success: `--dry-run` output shows "13 to remove" and no "missing from plugins"

- [x] [auditor] Re-verify Phase 11.3 Gate 4 after fixes — Success: All 13 SINGLETON_SKILLS verified in plugins
  - Run pytest to confirm 46/46 still passing
  - Verify PLUGIN_REGISTRY now has all 13 skills
  - Re-run Gate 4 spot-check for Migration Script Integration
  - Success: All 13 SINGLETON_SKILLS can be verified in plugins

- [ ] [coder] After auditor approval: Execute migration --apply
  - Ensure all uncommitted changes are committed
  - Run `python scripts/migrate_skills_to_plugins.py --apply`
  - Verify 13 skills removed from skills/
  - Confirm skills/skills.overview.md updated
  - Success: skills/ directory reduced from ~30 to ~17 skills

- [ ] [auditor] Final verification post-migration
  - Verify no skills in both locations (skills/ AND optional_plugins/)
  - Test /manifest command on V1 and V2 projects
  - Test /sync with upgraded manifests
  - Test /audit with plugins
  - Success: No regressions in concierge workflows

---

# Phase 12: Standardize Artifacts Workflow

## Phase 12.1: Update Global Rules

- [-] [coder] Update `CLAUDE.md` Artifacts section — Success: Root/Plans/Reports/History structure documented with lifecycle
- [ ] [coder] Update `orchestration.md` persistence table — Success: Plans, Reports, History rows added; learnings/MEMORY_ANCHORS marked as persistent
- [ ] [coder] Create `templates/Phase-N-Plan.md.template` — Success: Template with Objectives, Technical Approach, File Changes, Dependencies, Success Metrics
- [ ] [coder] Create `templates/Phase-N-TODO.md.template` — Success: Phase-scoped todo template matching root TODO.md format

## Phase 12.2: Update Documentation

- [ ] [scribe] Update `cheatsheet.md` Artifacts section — Success: Visual tree + lifecycle explanation added
- [ ] [scribe] Update `README.md` Artifacts references — Success: Developer section mentions new structure

- [ ] [auditor] Final verification — Success: All rules updated, templates created, no breaking changes

