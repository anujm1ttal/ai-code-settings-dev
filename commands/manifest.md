---
description: Validates and visualizes the project.json manifest. Shows active skills, detects unused declarations, and proposes optimizations for token savings. Owned by the concierge.
argument-hint: "[--optimize] [--export]"
---

# Command: /manifest

Owned by the **concierge**. Inspects, validates, and optimizes the project skill manifest.

## Execution Sequence

1. **Load Manifest**: Read `project.json` from project root. If missing, report and offer to create one.
2. **Schema Validation**: Validate against `templates/project.schema.json`.
   - Check `project_type` is valid (code, geometry, data, pptx, pbi-report, youtube, manuscript, hybrid).
   - Verify `auto_include` is boolean.
   - Verify `active_skills` and `disabled_skills` are arrays.
3. **Skill Registry Check**: Cross-reference declared skills against actual skill registry.
   - Flag skills in manifest that don't exist in `skills/` (typos, removed skills).
   - Flag skills declared but never used by active agents.
4. **Compute Effective Skill List**:
   - If `auto_include=true`: defaults[project_type] + active_skills - disabled_skills.
   - If `auto_include=false`: active_skills only.
5. **Coverage Analysis**:
   - List all active skills with L0 descriptions.
   - Calculate token savings vs. full registry (L1 metadata cost).
   - Identify skill gaps (common use cases not covered).
6. **Optimization Scan** (if `--optimize`):
   - Find skills in `active_skills` that duplicate default skills (dead weight).
   - Suggest moving `auto_include=false` if current set is < 5 skills.
   - Flag disabled skills that are actually used (should be removed).
7. **Output**: Manifest Report (see format below).

## Manifest Report Format

**Header**:
- Project name (from manifest)
- Project type
- Auto-include: yes/no
- Active skills count
- Default skills count
- Effective skills count

**Manifest Status**:
- ✅ Schema valid / ❌ Schema invalid (list errors)
- ✅ All skills exist / ⚠️ Unknown skills (list with hints)
- ✅ Manifest in git / ⚠️ Manifest not tracked

**Effective Skill List**:
```
Active Skills (N):
├── skill-name-1 (description)
├── skill-name-2 (description)
├── skill-name-3 (description)
...

Disabled Skills (M) [not active]:
├── skill-name-A
├── skill-name-B
```

**Token Analysis**:
```
Current Setup:
- L1 metadata cost: XXX tokens (~100 tokens per skill)
- Estimated L2 usage: varies by session

Savings Opportunity:
- If auto_include=false: save ~2,400 tokens/session
  (requires: only keep 3-4 skills in active_skills)
```

**Recommendations** (if any):
- "Consider moving to auto_include=false: current set has only 4 skills"
- "Unknown skill 'foo-bar' in active_skills (typo?)"
- "Skill 'deprecated-tool' in disabled_skills but not in defaults"

**Export** (if `--export`):
- Write report to `Artifacts/Temp/manifest_report_[timestamp].md`
- Include this report in Artifacts for auditing

## When to Use

- Session start (check manifest is valid)
- Before reducing skills (visualize impact)
- When adding new skills (avoid duplicates)
- Pre-/post-handoff (ensure manifest is up-to-date)
- After merging conflicting project changes

## Arguments

- **`--optimize`**: Run optimization scan and suggest changes
- **`--export`**: Write report to Artifacts/Temp/ for audit trail

## Boundaries

Does NOT: modify `project.json` (only suggests changes), delete files, execute code.

**Authority**: Concierge can read/validate. Strategist must approve changes to manifest structure.

## Integration with Other Commands

- **`/sync`**: `/manifest` is called automatically to refresh skill allowlist
- **`/blueprint`**: Strategist reviews manifest fit during Step 0
- **`/audit`**: Auditor may flag manifest drift as HIGH-priority issue
