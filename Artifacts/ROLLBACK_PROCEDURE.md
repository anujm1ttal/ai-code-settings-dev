# Rollback Procedure: Plugin Migration (Phase 11.3)

## Executive Summary

If the automated rollback (`--rollback` flag) fails, this document provides manual steps to restore singleton skills from git. The 12 migrated skills can be recovered using git checkout commands. Estimated time: 5–10 minutes.

## Prerequisites

Before rolling back, verify:
1. You have git access to the repository (no uncommitted changes in `skills/`)
2. You are on the `plugin-migration` branch (or the branch where migration was applied)
3. Git history is intact (no destructive operations since migration)
4. You have permission to modify `skills/` directory

**⚠️ Warning**: Rollback will discard any uncommitted changes in the `skills/` directory. Commit or stash them first if needed.

## Step-by-Step Manual Rollback

### Step 1: Verify git history

```bash
cd /path/to/ai-code-settings
git log --oneline -n 5
```

Expected output: Recent commits including the migration. If history is missing or corrupted, stop and escalate.

### Step 2: Check current state

```bash
git status
```

If there are uncommitted changes in `skills/`, stash or commit them:

```bash
git stash
# OR
git add . && git commit -m "WIP: stashing changes before rollback"
```

### Step 3: Restore individual singleton skills

Restore each of the 12 skills from git. Run these commands in sequence:

```bash
# YouTube skills
git checkout HEAD -- skills/youtube-strategy/
git checkout HEAD -- skills/youtube-scriptwriting/
git checkout HEAD -- skills/youtube-retention/

# PowerPoint and Power BI
git checkout HEAD -- skills/pptx/
git checkout HEAD -- skills/powerbi-report/

# MCP tools
git checkout HEAD -- skills/python-mcp/
git checkout HEAD -- skills/typescript-mcp/

# Rhino/Geometry
git checkout HEAD -- skills/python-rhino-grasshopper/
git checkout HEAD -- skills/rhino-e2e-testing/
git checkout HEAD -- skills/rhino-unit-testing/
git checkout HEAD -- skills/cd-foundations/

# Manuscript and Business
git checkout HEAD -- skills/manuscript-review/
git checkout HEAD -- skills/business-analyst/
```

### Step 4: Restore the skills overview documentation

```bash
git checkout HEAD -- skills/skills.overview.md
```

### Step 5: Verify restoration

Confirm all skills are restored:

```bash
ls skills/ | grep -E "youtube-|pptx|powerbi-|python-mcp|typescript-mcp|python-rhino|rhino-e2e|rhino-unit|cd-foundations|manuscript-|business-analyst"
```

Expected output: 12 directories listed (or fewer if some were not copied to plugins yet).

### Step 6: Clear migration state

Remove the migration state file to reset the idempotent guard:

```bash
rm Artifacts/.agent/migration_state.json
```

### Step 7: Verify final state

```bash
git status
```

Expected: No modified files, or only `Artifacts/.agent/migration_state.json` was deleted.

## Verification Checklist

Use this checklist to confirm rollback succeeded:

- [ ] All 12 singleton skill directories exist in `skills/`
- [ ] `skills/skills.overview.md` references all 12 skills
- [ ] No uncommitted changes (or only deleted migration_state.json)
- [ ] Git status is clean: `git status` shows "nothing to commit"
- [ ] `optional_plugins/` still contains the copied skills (unchanged)
- [ ] Can run `/manifest` command without plugin resolution errors

Run this verification command:

```bash
python scripts/manifest_validator.py . --validate-plugins --list-plugins
```

Expected: All plugins listed, no errors about missing skills.

## If Rollback Fails

### Symptom: Git says "pathspec did not match any file"

**Cause**: Skill was not committed to git before migration, or git history is incomplete.

**Recovery**:
1. Check if a backup exists: `git show HEAD~1:skills/[skill-name]/SKILL.md`
2. If not, restore from a manual backup if available
3. If no backup exists, escalate to the project lead

**Example**:

```bash
# Check if skill exists in previous commit
git show HEAD~1:skills/python-mcp/SKILL.md > /dev/null && echo "Exists" || echo "Not found"
```

### Symptom: `skills/` directory appears corrupted or incomplete

**Cause**: Partial migration or git stale index.

**Recovery**:
1. Clear git cache: `git reset --hard HEAD`
2. Retry Step 3 (Restore individual skills)
3. If still failing, run: `git fsck --full` to check repository integrity

### Symptom: Automation said "Failed to restore from git"

**Cause**: The `--rollback` script detected an error during restoration.

**Recovery**:
1. Check the script logs for the specific skill that failed
2. Manually restore that skill using Step 3 above
3. Retry remaining skills
4. Verify with the checklist above

---

## Emergency Contact

If the rollback procedure does not restore the skills:

1. **Check**: `git reflog` to see if commits are still accessible
2. **Escalate**: Contact the project architect (strategist) with:
   - Output of `git status`
   - Output of `git reflog`
   - List of skills that could not be restored
   - Screenshot of error messages

3. **Worst-case**: Restore from a full project backup if available

---

## Related Commands

**Check git history for migration commits**:
```bash
git log --oneline --grep="plugin\|migrate\|migration" -n 10
```

**See all changes to skills/ in recent history**:
```bash
git log -p --follow -- skills/ | head -100
```

**Restore all files in a directory at once** (if needed):
```bash
git checkout HEAD -- skills/
```

---

## Prevention (For Future Migrations)

To prevent rollback failures in future migrations:

1. **Commit before migration**: Always commit all work before running `--apply`
2. **Backup branch**: Create a backup branch before migration:
   ```bash
   git branch backup/plugin-migration-$(date +%s)
   ```
3. **Test on sandbox**: Run `--dry-run` first on a test project
4. **Validate plugins**: After rollback, confirm plugin system is still functional:
   ```bash
   python scripts/manifest_validator.py . --validate-plugins
   ```
