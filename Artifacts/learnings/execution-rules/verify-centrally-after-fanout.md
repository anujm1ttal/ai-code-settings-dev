# Verify Centrally After Parallel Subagent Fan-Out

**Category:** execution-rule · **Filed:** 2026-07-06 (Phase OSA-2)

## Rule

After dispatching parallel subagents to edit disjoint file sets, run a
**central verification sweep** before committing. Each subagent sees ONLY its
assigned files and will honestly report "clean" — but references to the removed
thing live in files outside every agent's list.

## Evidence

Three coders pruned manifest references across 11 files and all reported clean.
A follow-up repo-wide `grep` caught 4 real leftovers none of them could see:
- `hooks/settings-template.json` still registered the deleted hook (broken path)
- `templates/README.md` was 100% about deleted manifests
- 2 dead migration scripts
- `MEMORY_ANCHORS.md` documented the retired architecture as current

## How

`grep -rnE '<retired-symbols>' --include=... . | grep -v <intentional/historical>`
over the whole tree. Also verify runtime (compile scripts, `--check` hooks, valid
JSON) — a deletion can break a config file no doc-edit agent was looking at.
