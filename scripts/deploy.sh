#!/bin/bash
# Deploy AI OS from ai-code-settings (dev) to ~/.claude/ (production)
# Usage: bash scripts/deploy.sh [--skip-tests] [--force]

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse flags
SKIP_TESTS=false
FORCE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-tests) SKIP_TESTS=true; shift ;;
    --force) FORCE=true; shift ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

# Get absolute paths
SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$HOME/.claude"

echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}AI OS Deployment: $SOURCE → $DEST${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 1: Validate Source
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${YELLOW}[1/6]${NC} Validating source repository..."

if [ ! -f "$SOURCE/tests/test_manifest_validator_v2.py" ]; then
  echo -e "${RED}✗ ERROR: Not in ai-code-settings root directory${NC}"
  exit 1
fi

if [ ! -d "$SOURCE/agents" ] || [ ! -d "$SOURCE/rules" ] || [ ! -d "$SOURCE/skills" ]; then
  echo -e "${RED}✗ ERROR: Missing required directories (agents/, rules/, skills/)${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Source validation passed${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 2: Run Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ "$SKIP_TESTS" = false ]; then
  echo -e "${YELLOW}[2/6]${NC} Running test suite..."
  if ! pytest "$SOURCE/tests/" -v --tb=short 2>&1 | tail -20; then
    echo -e "${RED}✗ Tests failed. Deploy aborted.${NC}"
    echo -e "    Use ${YELLOW}--skip-tests${NC} to skip (not recommended)"
    exit 1
  fi
  echo -e "${GREEN}✓ Tests passed${NC}"
else
  echo -e "${YELLOW}[2/6]${NC} Skipping tests (--skip-tests flag)"
fi
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 3: Check Destination
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${YELLOW}[3/6]${NC} Checking destination (~/.claude/)..."

if [ ! -d "$DEST" ]; then
  echo -e "${YELLOW}  → Creating $DEST...${NC}"
  mkdir -p "$DEST"
fi

if [ ! -d "$DEST/scripts" ]; then
  mkdir -p "$DEST/scripts"
fi

if [ ! -d "$DEST/optional_plugins" ]; then
  mkdir -p "$DEST/optional_plugins"
fi

echo -e "${GREEN}✓ Destination ready${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 4: Create Backup
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${YELLOW}[4/6]${NC} Creating backup..."

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$HOME/.claude.backup-$TIMESTAMP"

if [ -d "$DEST" ]; then
  cp -r "$DEST" "$BACKUP_DIR"
  echo -e "${GREEN}✓ Backup created: $BACKUP_DIR${NC}"
else
  echo -e "${YELLOW}  → No existing deployment to backup${NC}"
fi
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 5: Copy Production Artifacts
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${YELLOW}[5/6]${NC} Copying production artifacts..."

# Copy directories.
# Remove the destination first so `cp -r` creates a fresh copy instead of
# nesting the source inside an existing dir (e.g. optional_plugins/optional_plugins).
for dir in agents rules skills optional_plugins templates commands; do
  rm -rf "$DEST/$dir"
  cp -r "$SOURCE/$dir" "$DEST/$dir"
done

# Copy critical files
cp "$SOURCE/scripts/manifest_validator.py" "$DEST/scripts/manifest_validator.py"
cp "$SOURCE/optional_plugins/plugin_manifest_schema.json" "$DEST/optional_plugins/plugin_manifest_schema.json"
# CLAUDE-global.md is the deployable global (NOT the repo-specific CLAUDE.md)
cp "$SOURCE/CLAUDE-global.md"   "$DEST/CLAUDE.md"
cp "$SOURCE/cheatsheet.md"      "$DEST/cheatsheet.md"
cp "$SOURCE/README.md"          "$DEST/README.md"

echo -e "${GREEN}✓ Production artifacts copied${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 6: Validate Deployment
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${YELLOW}[6/6]${NC} Validating deployment..."

# Check all required directories exist
for dir in agents rules skills optional_plugins templates commands; do
  if [ ! -d "$DEST/$dir" ]; then
    echo -e "${RED}✗ Missing directory: $DEST/$dir${NC}"
    exit 1
  fi
done

# Check critical files exist
for file in CLAUDE.md cheatsheet.md README.md scripts/manifest_validator.py optional_plugins/plugin_manifest_schema.json; do
  if [ ! -f "$DEST/$file" ]; then
    echo -e "${RED}✗ Missing file: $DEST/$file${NC}"
    exit 1
  fi
done

# Test manifest_validator.py
if ! python "$DEST/scripts/manifest_validator.py" --list-plugins > /dev/null 2>&1; then
  echo -e "${RED}✗ manifest_validator.py validation failed${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Deployment validation passed${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SUCCESS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ DEPLOYMENT COMPLETE${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}Source:${NC}  $SOURCE"
echo -e "  ${GREEN}Dest:${NC}    $DEST"
echo -e "  ${GREEN}Backup:${NC}  $BACKUP_DIR"
echo ""
echo "Next: New Claude Code sessions will load from ~/.claude/"
echo ""
echo "Rollback (if needed):"
echo "  rm -rf ~/.claude && cp -r $BACKUP_DIR ~/.claude"
echo ""
