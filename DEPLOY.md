# Deployment Checklist: ai-code-settings → ~/.claude/

Deploy the AI OS from development (this repo) to production (~/.claude/).

---

## Pre-Deployment Validation

- [ ] All uncommitted changes are staged or stashed
- [ ] All tests pass: `pytest tests/ -v`
- [ ] No TODOs blocking: `Artifacts/TODO.md` phase complete
- [ ] Git status clean: `git status` shows no surprises
- [ ] Decision log updated: `Artifacts/DECISION_LOG.md` has latest pivots

---

## Copy Runtime Artifacts

These directories and files are **production** — they get copied to ~/.claude/:

```bash
# Navigate to ai-code-settings repo root
cd c:\Users\44547\source\repos\ai-code-settings

# Copy runtime directories (production-only)
cp -r agents/           ~/.claude/agents/
cp -r rules/            ~/.claude/rules/
cp -r skills/           ~/.claude/skills/
cp -r optional_plugins/ ~/.claude/optional_plugins/
cp -r templates/        ~/.claude/templates/

# Copy runtime scripts (only manifest_validator.py, not migration utils)
cp scripts/manifest_validator.py ~/.claude/scripts/manifest_validator.py

# Copy schema file
cp optional_plugins/plugin_manifest_schema.json ~/.claude/optional_plugins/plugin_manifest_schema.json

# Copy reference docs
cp CLAUDE.md   ~/.claude/CLAUDE.md
cp cheatsheet.md ~/.claude/cheatsheet.md
cp README.md   ~/.claude/README.md
```

---

## What NOT to Copy

These stay in ai-code-settings only (development/testing):

- ❌ `tests/` — development validation only
- ❌ `scripts/migrate_skills_to_plugins.py` — one-time utility
- ❌ `scripts/phase_11_*.py` — one-time utilities
- ❌ `Artifacts/TODO.md` — repo-specific tracking
- ❌ `Artifacts/DECISION_LOG.md` — repo-specific history
- ❌ `Artifacts/learnings/` — repo-specific learnings
- ❌ `.git/`, `.gitignore`, etc. — version control
- ❌ Any other scripts in `scripts/` except `manifest_validator.py`

---

## Validate Deployment

```bash
# Check all required files exist in ~/.claude/
ls -la ~/.claude/agents/
ls -la ~/.claude/rules/common/
ls -la ~/.claude/skills/
ls -la ~/.claude/optional_plugins/
ls -la ~/.claude/templates/
ls -la ~/.claude/scripts/manifest_validator.py

# Verify manifest_validator.py works
python ~/.claude/scripts/manifest_validator.py --list-plugins

# Spot-check one skill (should match source)
diff -r \
  c:\Users\44547\source\repos\ai-code-settings\skills\codebase-navigator \
  ~/.claude/skills/codebase-navigator
# Should show no differences
```

---

## Verify in a Test Project

Create a temporary test project to confirm ~/.claude/ loads correctly:

```bash
# Create test directory
mkdir -p /tmp/test-project
cd /tmp/test-project

# Copy template from ~/.claude/
cp ~/.claude/templates/project-code.json project.json

# Test manifest validation
python ~/.claude/scripts/manifest_validator.py --file project.json

# Expected output: V2 schema validation PASS, all plugins listed
```

---

## Archive Old Version (Safety)

Before overwriting ~/.claude/, keep a backup:

```bash
# Create timestamped backup
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
cp -r ~/.claude ~/.claude.backup-$TIMESTAMP

# List backups
ls -la ~/ | grep .claude.backup
```

---

## Rollback Procedure

If deployment causes issues:

```bash
# Restore from backup
TIMESTAMP=20260703-143022  # Replace with actual timestamp
rm -rf ~/.claude
cp -r ~/.claude.backup-$TIMESTAMP ~/.claude

# Verify rollback
python ~/.claude/scripts/manifest_validator.py --list-plugins
```

---

## Post-Deployment: Update Project Templates

After syncing to ~/.claude/, projects should use templates from there:

```bash
# For a new project:
cp ~/.claude/templates/project-code.json /my-project/project.json

# For existing projects (optional):
# No change needed — they already use their own project.json
# But they can update to latest template version if desired
```

---

## Deployment Record

Keep track of deployments. Add an entry each time you sync:

| Date | Version | Changes | Status |
|:---|:---|:---|:---|
| 2026-07-03 | v11.0.0 | Plugin system MVP complete | ✓ DEPLOYED |
| — | — | — | — |

---

## Automation (Future)

Consider creating a deploy script:

```bash
#!/bin/bash
# scripts/deploy.sh (add to ai-code-settings repo)

set -e  # Exit on error

SOURCE=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DEST="$HOME/.claude"

echo "Deploying $SOURCE → $DEST"

# Validate source
if [ ! -f "$SOURCE/tests/test_manifest_validator_v2.py" ]; then
  echo "ERROR: Not in ai-code-settings root"
  exit 1
fi

# Run tests before deploy
pytest "$SOURCE/tests/" -v || exit 1

# Create backup
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
cp -r "$DEST" "$DEST.backup-$TIMESTAMP"
echo "Backup created: $DEST.backup-$TIMESTAMP"

# Copy production artifacts
cp -r "$SOURCE/agents"          "$DEST/agents"
cp -r "$SOURCE/rules"           "$DEST/rules"
cp -r "$SOURCE/skills"          "$DEST/skills"
cp -r "$SOURCE/optional_plugins" "$DEST/optional_plugins"
cp -r "$SOURCE/templates"       "$DEST/templates"
cp "$SOURCE/scripts/manifest_validator.py" "$DEST/scripts/manifest_validator.py"
cp "$SOURCE/optional_plugins/plugin_manifest_schema.json" "$DEST/optional_plugins/plugin_manifest_schema.json"
cp "$SOURCE/CLAUDE.md"          "$DEST/CLAUDE.md"
cp "$SOURCE/cheatsheet.md"      "$DEST/cheatsheet.md"
cp "$SOURCE/README.md"          "$DEST/README.md"

# Validate
python "$DEST/scripts/manifest_validator.py" --list-plugins

echo "✓ Deployment complete"
echo "  Source: $SOURCE"
echo "  Dest:   $DEST"
echo "  Backup: $DEST.backup-$TIMESTAMP"
```

Usage:
```bash
bash scripts/deploy.sh
```

---

## Checklist for Each Deployment

- [ ] Pre-deployment validation passed
- [ ] All runtime artifacts copied
- [ ] Dev-only artifacts excluded
- [ ] Backup created
- [ ] Deployment validated (manifest_validator works)
- [ ] Test project confirms loading
- [ ] Rollback procedure documented
- [ ] Deployment record updated

---

**Last updated**: July 3, 2026  
**Status**: Template ready for first production deployment
