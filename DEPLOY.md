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
cd /path/to/ai-code-settings   # your clone

# Copy runtime directories (production-only). Remove the destination first —
# `cp -r dir/ dest/dir/` on an existing dest nests source-inside-dest instead
# of replacing it, so rm-before-cp matches what scripts/deploy.sh actually does.
for d in agents rules skills templates commands hooks; do
  rm -rf ~/.claude/$d
  cp -r $d/ ~/.claude/$d/
done

# Copy reference docs
# CLAUDE-global.md is the deployable global (repo-specific CLAUDE.md is NOT deployed)
cp CLAUDE-global.md ~/.claude/CLAUDE.md
cp cheatsheet.md ~/.claude/cheatsheet.md
cp README.md   ~/.claude/README.md
```

`optional_plugins/` is intentionally **not** copied — real plugin installs live in
`~/.claude/plugins/` via `/plugin marketplace add` + `/plugin install` from
`.claude-plugin/marketplace.json`, not a raw folder copy.

### Shipping a plugin change [required order]

`deploy.sh` does **not** ship plugins. A plugin edit reaches a project only after both
steps below, **in this order**:

1. **Bump the version** in `optional_plugins/<plugin>/.claude-plugin/plugin.json`. The
   install cache is keyed on *version* (`~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`),
   so an unchanged version means the fix may never be copied.
2. **Refresh the marketplace, then reinstall — per project:**
   ```
   /plugin marketplace update ai-code-settings
   /plugin install <plugin>@ai-code-settings
   ```

**Skipping step 2's update is a silent no-op.** The installer compares against the cached
marketplace catalogue; if that catalogue predates your bump it concludes the installed
version is current and copies nothing — no error, no warning. Verified 2026-07-29: a
reinstall without the update left the cache untouched with an mtime twelve days old.

Propagation is **per project**. Other projects stay on their old cache directory until
each is reinstalled — check with:

```bash
python -c "import json,pathlib;d=json.loads(pathlib.Path.home().joinpath('.claude/plugins/installed_plugins.json').read_text());[print(e['version'],e['projectPath']) for e in d['plugins']['<plugin>@ai-code-settings']]"
```

**Verify from a consuming project, never from this repo.** Relative paths and skill
triggers both resolve differently there, so a check run inside `ai-code-settings` can pass
while the installed copy is broken.

---

## Publishing a public snapshot release

This repository is the **private development repo** (`ai-code-settings-dev`). The public
repository at `ai-code-settings` is a **curated snapshot** of tracked files — it deliberately
carries no development history.

**Why a snapshot rather than the real history:** this repo once vendored Anthropic-licensed
Office skills whose licence bars redistribution. They are gone from `HEAD` but remain in every
historical commit. Publishing a snapshot means the licensed content **was never present** in the
public repository — a guarantee, rather than a rewrite whose completeness depends on platform
garbage collection.

### Pushing an update

```bash
# 1. Stage a snapshot from TRACKED FILES ONLY.
#    git archive is the whole point: it emits the HEAD tree, so gitignored paths
#    (Artifacts/, optional_plugins/ms-office/) cannot leak in. Never use cp -r or rsync.
SNAP=$(mktemp -d)
git archive main | tar -x -C "$SNAP"

# 2. Verify before pushing — absence proof plus a presence control.
find "$SNAP" -path '*/docx/*' -o -path '*/xlsx/*' -o -path '*/pptx/*' | wc -l   # must be 0
test -d "$SNAP/Artifacts" && echo "LEAK — Artifacts/ present" || echo "OK"
ls "$SNAP/optional_plugins/geometry/skills" | wc -l                             # control: must be >0

# 3. Commit and force-push the snapshot to the public remote.
cd "$SNAP" && git init -q && git add -A
git commit -q -m "snapshot: <version>"
git push --force https://github.com/anujm1ttal/ai-code-settings.git HEAD:main
```

Step 3 replaces the public repo's single commit each release; the public repo intentionally has
no incremental history to preserve. Run `scripts/deploy.sh` and the test suite **before**
snapshotting — the snapshot ships whatever `main` holds.

> [!IMPORTANT]
> **A snapshot that is never re-pushed rots silently** and misrepresents the project to anyone
> reading it. Publish a snapshot with every release that changes tracked files, or the public
> repo becomes a lie of omission rather than a curated view.

> [!WARNING]
> **Never add licensed third-party content to a tracked path** — see `CLAUDE.md` §Local law.
> The step-2 check is a backstop, not a licence to be careless: it only catches the paths it
> knows about.

---

## What NOT to Copy

These stay in ai-code-settings only (development/testing):

- ❌ `CLAUDE.md` — repo-specific guidance for maintaining the OS (the global is `CLAUDE-global.md`)
- ❌ `tests/` — development validation only
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
ls -la ~/.claude/hooks/

# Spot-check one skill (should match source)
diff -r \
  skills/codebase-navigator \
  ~/.claude/skills/codebase-navigator
# Should show no differences
```

---

## Backups (handled by scripts/deploy.sh)

`scripts/deploy.sh` creates `~/.claude.backup-<timestamp>/` automatically before
copying. The backup covers **only the items this script deploys**
(`agents/ rules/ skills/ templates/ commands/ hooks/ CLAUDE.md cheatsheet.md
README.md`) — not all of `~/.claude/` (which also holds `plugins/`, `projects/`,
`shell-snapshots/`, `settings.json`, etc.). Older backups beyond the last 5 are
pruned automatically.

```bash
# List backups
ls -1d ~/.claude.backup-* | sort
```

---

## Rollback Procedure

If deployment causes issues, restore the deployed items from a backup. This
replaces each item **entirely** (remove-then-copy, not merge-copy) so anything
added to `~/.claude/` after the backup was taken does not survive the
rollback — a plain `cp -r "$BACKUP/." ~/.claude/` would leave such additions
in place because `cp -r` only overlays, never deletes. Rollback still does
not touch `plugins/`, `projects/`, or `settings.json` (never backed up in the
first place):

```bash
BACKUP=~/.claude.backup-20260703-143022  # Replace with actual timestamp
for item in agents rules skills templates commands hooks CLAUDE.md cheatsheet.md README.md; do
  rm -rf ~/.claude/$item
  [ -e "$BACKUP/$item" ] && cp -r "$BACKUP/$item" ~/.claude/$item
done
```

---

## Deployment Record

Keep track of deployments. Add an entry each time you sync:

| Date | Version | Changes | Status |
|:---|:---|:---|:---|
| 2026-07-03 | v11.0.0 | Plugin system MVP complete | ✓ DEPLOYED |
| 2026-07-06 | — | CMD: CLAUDE.md standard + global/project split + `/claude-md`; deploy.sh repaired (OSA-2 regression) + now deploys `commands/` | ✓ DEPLOYED |

---

## Automation

`scripts/deploy.sh` already implements the steps above (validate source → run
`tests/` → back up deployed items → copy `agents/ rules/ skills/ templates/
commands/ hooks/` + top-level docs → validate). It intentionally excludes
`optional_plugins/` (installed via the marketplace instead).

Usage:
```bash
bash scripts/deploy.sh                # full run
bash scripts/deploy.sh --skip-tests   # skip pytest (not recommended)
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

**Last updated**: July 7, 2026 (OSH-6)  
**Status**: Mirrors `scripts/deploy.sh` as-built; see Deployment Record above for history
