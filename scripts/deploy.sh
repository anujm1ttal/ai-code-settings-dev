#!/bin/bash
# Deploy AI OS from ai-code-settings (dev) to ~/.claude/ (production)
# Usage: bash scripts/deploy.sh [--skip-tests]

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse flags
SKIP_TESTS=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-tests) SKIP_TESTS=true; shift ;;
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

if [ ! -f "$SOURCE/CLAUDE-global.md" ]; then
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
  # Only run pytest if the suite actually contains test files.
  if ls "$SOURCE"/tests/test_*.py >/dev/null 2>&1; then
    # `if python -m pytest ...` (not `pytest ...; rc=$?`) so a nonzero exit is
    # caught by the conditional instead of triggering `set -e` before the hint
    # prints. `python -m pytest` (not the bare `pytest.exe` launcher) — the
    # launcher raises WinError 6 on subprocess-spawning tests on Windows.
    if python -m pytest "$SOURCE/tests/" --tb=short; then
      echo -e "${GREEN}✓ Tests passed${NC}"
    else
      echo -e "${RED}✗ Tests failed. Deploy aborted.${NC}"
      echo -e "    Use ${YELLOW}--skip-tests${NC} to skip (not recommended)"
      exit 1
    fi
  else
    echo -e "${YELLOW}  → No test files in tests/ — skipping (nothing to run)${NC}"
  fi
else
  echo -e "${YELLOW}[2/6]${NC} Skipping tests (--skip-tests flag)"
fi
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 3: Check Destination
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${YELLOW}[3/6]${NC} Checking destination (~/.claude/) and deploy parity..."

if [ ! -d "$DEST" ]; then
  echo -e "${YELLOW}  → Creating $DEST...${NC}"
  mkdir -p "$DEST"
fi

# Deployed-vs-source drift gate (DSD-1 T3). MUST stay above step 4 and step 5:
# step 4 prunes old backups (`rm -rf "${ALL_BACKUPS[$i]}"`) — the very copies a
# drift recovery would need — and step 5 does `rm -rf "$DEST/$dir"` before
# copying. A deployed-ahead file exists ONLY in ~/.claude/, so either one
# destroys it with no trace. The detector prints the offending file list and the
# back-port instruction itself, so the abort below does not repeat them.
# `if python ...` (not a bare call) so a nonzero exit is caught here instead of
# tripping `set -e` before the abort message prints — same reason as step 2.
if python "$SOURCE/scripts/verify_deploy_parity.py" --source-root "$SOURCE" --dest-root "$DEST"; then
  echo -e "${GREEN}✓ No deployed-ahead drift${NC}"
else
  echo ""
  echo -e "${RED}✗ ERROR: deployed-ahead drift detected. Deploy aborted.${NC}"
  echo -e "    Nothing has been backed up, deleted, or copied — ~/.claude/ is untouched."
  exit 1
fi

echo -e "${GREEN}✓ Destination ready${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 4: Create Backup
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${YELLOW}[4/6]${NC} Creating backup..."

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$HOME/.claude.backup-$TIMESTAMP"
# Only the items this script deploys — NOT the full ~/.claude/ (which also
# holds projects/, plugins/, shell-snapshots/, etc. and would bloat backups).
DEPLOYED_ITEMS=(agents rules skills templates commands hooks CLAUDE.md cheatsheet.md README.md)

if [ -d "$DEST" ]; then
  mkdir -p "$BACKUP_DIR"
  for item in "${DEPLOYED_ITEMS[@]}"; do
    if [ -e "$DEST/$item" ]; then
      cp -r "$DEST/$item" "$BACKUP_DIR/$item"
    fi
  done
  echo -e "${GREEN}✓ Backup created: $BACKUP_DIR${NC}"

  # Prune to the last 5 backups so ~/.claude.backup-* doesn't grow unbounded.
  mapfile -t ALL_BACKUPS < <(ls -1d "$HOME"/.claude.backup-* 2>/dev/null | sort)
  PRUNE_COUNT=$((${#ALL_BACKUPS[@]} - 5))
  if [ "$PRUNE_COUNT" -gt 0 ]; then
    for ((i = 0; i < PRUNE_COUNT; i++)); do
      rm -rf "${ALL_BACKUPS[$i]}"
    done
    echo -e "${YELLOW}  → Pruned $PRUNE_COUNT old backup(s), keeping last 5${NC}"
  fi
else
  echo -e "${YELLOW}  → No existing deployment to backup${NC}"
fi
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 5: Copy Production Artifacts
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${YELLOW}[5/6]${NC} Copying production artifacts..."

# skills/synced/ is written by the Claude Code harness itself (account-level
# skill sync — e.g. docx/pptx/xlsx/pdf/skill-creator bundles under a per-account
# UUID) — NOT by this repo, and deploy.sh has no source-tree copy to restore it
# from. It carries third-party-licensed content (see CLAUDE.md's no-vendoring
# HARD-GATE) that must never be backported into source, so the only safe
# handling is: never delete it. Preserve by moving it aside before the
# wipe-and-recopy below, then restoring it — this is NOT a glob/copy-loop
# exclusion (CPI-1 T5 already found that shape brittle); it physically cannot
# be touched by `rm -rf "$DEST/skills"` while it lives outside that path.
SYNCED_PRESERVE="$DEST/.skills-synced-preserve-tmp"

# Crash-recovery, BEFORE anything else: if a previous run's move-aside never
# made it back (crash/kill mid-loop), $SYNCED_PRESERVE holds the last-known-good
# synced/ and is the only copy of it that exists anywhere — it cannot be
# re-vendored from source. Restore it now rather than let the unconditional
# cleanup below delete it; an unconditional `rm -rf "$SYNCED_PRESERVE"` here
# would silently convert one interrupted run into permanent loss on the NEXT
# run, which is worse than doing nothing at all.
if [ -d "$SYNCED_PRESERVE" ] && [ ! -e "$DEST/skills/synced" ]; then
  echo -e "${YELLOW}  → Recovering skills/synced/ left over from an interrupted deploy...${NC}"
  mkdir -p "$DEST/skills"
  mv "$SYNCED_PRESERVE" "$DEST/skills/synced"
fi
rm -rf "$SYNCED_PRESERVE"

# Trap backstop: the move-aside/wipe/restore below runs under the script-wide
# `set -e` (line 5) with NO existing trap, so any failure among the 12 rm/cp
# ops in the loop — or an interactive Ctrl-C — previously exited the script
# with skills/synced/ stranded in $SYNCED_PRESERVE and nothing pointing at it.
# This trap is a backstop, not the primary path: the inline restore after the
# loop still runs on the happy path (kept for a linear, readable success flow
# and an immediate post-condition at the point of use); the trap exists solely
# to make every OTHER exit (error under set -e, INT, TERM) also restore before
# the script leaves. It is idempotent — a no-op once the inline restore has
# already moved $SYNCED_PRESERVE back — and is disarmed (`trap - EXIT INT TERM`)
# right after that inline restore succeeds so it can't fire redundantly during
# step 5's tail or step 6. Does not, and cannot, cover SIGKILL / power loss —
# see this run's fault-injection evidence for what it does cover.
# The handler itself never calls `exit`: it is also registered for EXIT, and
# bash suppresses re-entrant EXIT traps, so any explicit `exit` inside it would
# not fire the EXIT trap a second time — meaning a call arriving via INT/TERM
# would never re-trigger the same restore on the way out. Instead, INT/TERM
# each call the handler and THEN exit explicitly (128+signum, the conventional
# code); that exit still re-fires the EXIT trap, which is a harmless no-op —
# restore_synced_on_exit is conditional on `[ -d "$SYNCED_PRESERVE" ]`, which
# is already false the second time it runs.
restore_synced_on_exit() {
  if [ -d "$SYNCED_PRESERVE" ]; then
    echo -e "${RED}  → Deploy interrupted: restoring skills/synced/ from backstop...${NC}" >&2
    mkdir -p "$DEST/skills"
    mv "$SYNCED_PRESERVE" "$DEST/skills/synced"
  fi
}
trap restore_synced_on_exit EXIT
trap 'restore_synced_on_exit; exit 130' INT
trap 'restore_synced_on_exit; exit 143' TERM

if [ -d "$DEST/skills/synced" ]; then
  mv "$DEST/skills/synced" "$SYNCED_PRESERVE"
fi

# Copy directories.
# optional_plugins is intentionally excluded: real plugin installs live in
# ~/.claude/plugins/ via the marketplace, not a raw copy of the repo folder.
# Remove the destination first so `cp -r` creates a fresh copy instead of
# nesting the source inside an existing dir (e.g. rules/rules).
for dir in agents rules skills templates commands hooks; do
  rm -rf "$DEST/$dir"
  cp -r "$SOURCE/$dir" "$DEST/$dir"
done

if [ -d "$SYNCED_PRESERVE" ]; then
  mkdir -p "$DEST/skills"
  mv "$SYNCED_PRESERVE" "$DEST/skills/synced"
fi
trap - EXIT INT TERM

# Copy critical files
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
for dir in agents rules skills templates commands hooks; do
  if [ ! -d "$DEST/$dir" ]; then
    echo -e "${RED}✗ Missing directory: $DEST/$dir${NC}"
    exit 1
  fi
done

# Check critical files exist
for file in CLAUDE.md cheatsheet.md README.md commands/claude-md.md hooks/session-boot.js hooks/guard-commands.js; do
  if [ ! -f "$DEST/$file" ]; then
    echo -e "${RED}✗ Missing file: $DEST/$file${NC}"
    exit 1
  fi
done

# Hook-wiring guard (LH-3 T2b): every hooks/enforced-rules.json entry must be
# both deployed AND referenced under its declared event in the live
# settings.json. Fails CLOSED, unlike the runtime hooks — a wiring gap that
# ships silently is the exact failure mode this guard exists to prevent
# (hit manually in LH-1 and LH-2). Exception: a completely absent
# settings.json (fresh machine, before hooks/README.md Step 2's manual merge)
# only WARNs and exits 0 — that's expected bootstrap state, not a regression.
if ! python "$SOURCE/scripts/verify_hook_wiring.py" \
  --manifest "$SOURCE/hooks/enforced-rules.json" \
  --hooks-dir "$DEST/hooks" \
  --settings-file "$DEST/settings.json"; then
  echo -e "${RED}✗ Hook-wiring guard failed. Deploy aborted.${NC}"
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
echo "Rollback (if needed — backup only covers deployed items, not all of ~/.claude/;"
echo "replaces each item fully so anything added post-backup doesn't survive):"
echo "  for item in ${DEPLOYED_ITEMS[@]}; do rm -rf \"$DEST/\$item\"; [ -e \"$BACKUP_DIR/\$item\" ] && cp -r \"$BACKUP_DIR/\$item\" \"$DEST/\$item\"; done"
echo ""
