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

## Mirror failure mode: duplication from overlapping ADDITIONS (Phase GHP-1, 2026-07-17)

The same blindness bites in reverse. Four parallel doc-authoring coders each,
independently, documented the SAME shared facts (the `rhinocode` exit-0-before-done
trap landed in ~5 files; `rhinoinside.load()`-defaults-to-7 in 2) — each agent saw
only its own files, so none knew a sibling was writing the same thing. The auditor
correctly failed it on the no-re-documentation rule (HR2), costing a full fix+re-audit cycle.

**Prevention (do this at dispatch time, not just verify after):** before fanning out
authoring agents over related content, assign **single-ownership of each shared fact** —
name the ONE file that owns it and instruct every other agent to write a *pointer*, not a
restatement. A shared fact with no named owner will be re-derived by every agent that
touches an adjacent topic. Then still run the central sweep above to confirm ownership held.
