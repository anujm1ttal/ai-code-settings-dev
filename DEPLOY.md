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
cp -r templates/        ~/.claude/templates/
cp -r commands/         ~/.claude/commands/

# Copy reference docs
# CLAUDE-global.md is the deployable global (repo-specific CLAUDE.md is NOT deployed)
cp CLAUDE-global.md ~/.claude/CLAUDE.md
cp cheatsheet.md ~/.claude/cheatsheet.md
cp README.md   ~/.claude/README.md
```

Plugins are not copied here — they install via `/plugin marketplace add` + `/plugin install` from `.claude-plugin/marketplace.json`.

---

## What NOT to Copy

These stay in ai-code-settings only (development/testing):

- ❌ `CLAUDE.md` — repo-specific guidance for maintaining the OS (the global is `CLAUDE-global.md`)
- ❌ `tests/` — development validation only
- ❌ `scripts/migrate_skills_to_plugins.py` — one-time utility
- ❌ `scripts/phase_11_*.py` — one-time utilities
- ❌ `Artifacts/TODO.md` — repo-specific tracking
- ❌ `Artifacts/DECISION_LOG.md` — repo-specific history
- ❌ `Artifacts/learnings/` — repo-specific learnings
- ❌ `.git/`, `.gitignore`, etc. — version control
- ❌ Scripts in `scripts/` — dev-time utilities, not required at runtime

---

## Validate Deployment

```bash
# Check all required files exist in ~/.claude/
ls -la ~/.claude/agents/
ls -la ~/.claude/rules/common/
ls -la ~/.claude/skills/
ls -la ~/.claude/templates/

# Spot-check one skill (should match source)
diff -r \
  c:\Users\44547\source\repos\ai-code-settings\skills\codebase-navigator \
  ~/.claude/skills/codebase-navigator
# Should show no differences
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
if [ ! -f "$SOURCE/CLAUDE.md" ]; then
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
cp -r "$SOURCE/templates"       "$DEST/templates"
cp "$SOURCE/CLAUDE-global.md"   "$DEST/CLAUDE.md"
cp "$SOURCE/cheatsheet.md"      "$DEST/cheatsheet.md"
cp "$SOURCE/README.md"          "$DEST/README.md"

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
- [ ] Deployment validated (spot-check diff passed)
- [ ] Rollback procedure documented
- [ ] Deployment record updated

---

**Last updated**: July 3, 2026  
**Status**: Template ready for first production deployment
