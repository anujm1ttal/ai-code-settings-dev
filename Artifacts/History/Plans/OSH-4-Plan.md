# Phase OSH-4: Registry Reconciliation & Skill Hygiene

**Initiative:** OSH — OS Hardening · **Findings:** AUDIT_REPORT.md §3 (CM subset), §4 (RU-F6..F8), §5 (SK-*), AG-12/18
**Branch:** `phase-osh-4-registry-skills` · **Owner:** coder (+ scribe for description rewrites) → auditor

## Objectives

Every registry (CLAUDE-global tables, orchestration tables, skills.overview.md, plugin
manifests) names exactly what exists, with one owner per command; the retired-manifest
vestiges (METADATA.yaml) are gone; skill descriptions meet the house trigger standard; and
command procedures are internally consistent (gates that exist, files that get created,
frontmatter that enforces what prose promises).

## Technical Approach

**Ownership decisions (binding):**
- `/deck` owner = **concierge / coder / auditor** (match the file's actual routing; update registries).
- `/grill` owner = **strategist** (registries win; orchestration routing note may say "council for /council escalation").
- `business-analyst` moves `optional_plugins/manuscript/skills/business-analyst/` → core `skills/business-analyst/` (strategist skill, zero manuscript content — SK-9/AG-11). Update manuscript plugin.json + marketplace.json + index.md + overview + strategist.md ("when available" → required, now core).
- `skills/skill-creator/` **deleted** — exact duplicate of installed plugin (SK-11); registries repoint to the plugin.
- All 17 `METADATA.yaml` **deleted**; each of 7 `plugin.json` gains `"version"` (seed from the SKILL.md frontmatter version where present, else `1.0.0`) (SK-2, SK-14).
- L0 abstracts (SK-5): amend TOKEN-ECONOMICS — L0 mandatory only for skills > 150 lines; write abstracts for the 6 largest lacking one (dax-modeling, python-patterns, doc-updater, rhino-e2e-testing, pptx-slide-design, powerbi-report). Others exempt.
- Non-spec frontmatter keys (SK-19): move `tags`/`globs`/`auto_activate`/`verbosity_control` under `metadata:`; delete `auto_activate` outright (falsely implies a loader).
- Command registry canonical home = **CLAUDE-global.md** (single table); orchestration's Command Fleet table becomes a pointer + routing prose (executed in OSH-5; in THIS phase the CLAUDE-global table is made complete/correct so OSH-5 deletes duplicates against a correct master).

## File Changes

### A. Registry correctness

| File | Edit | Findings |
|:---|:---|:---|
| `CLAUDE-global.md` | Agents table: add geometry-validator row (role: "Geometric auditing (dispatched by auditor)"). Commands table: `/deck` owner fix; add rows/mentions for `test-driven-development` + `receiving-code-review` in the foundational-skills line; add `pptx-slide-design` beside banana-prompt; note docx/xlsx under pptx/ms-office routing; remove the duplicate `/learn` row in Persistent Learnings section. | AG-12, CM-5, SK-12, RU-D2 (partial) |
| `rules/common/orchestration.md` | Fleet table: add geometry-validator row with write boundary ("Write: geometry audit reports; dispatched subagent"). Command Fleet table: add the 8 missing rows (full dedup deferred to OSH-5). `/grill` routing note aligned. | AG-12/RU-F6, CM-2, RU-F8 |
| `rules/common/model-routing.md` | Add geometry-validator to the binding YAML (sonnet, tier 2). | AG-12 |
| `skills/skills.overview.md` | Fix ghost plugin names `ms-office-core`→`ms-office`, `visual-storytelling-core`→`visual-storytelling` (:29,:41). Geometry section: pointer note to `optional_plugins/geometry/` (:31-34). Remove skill-creator core row → plugin pointer. Add business-analyst (now core). Refresh core count (14 → new count after moves). | SK-3, SK-4, SK-11, SK-9 |

### B. Plugin & skill hygiene

| File | Edit | Findings |
|:---|:---|:---|
| `optional_plugins/*/skills/*/METADATA.yaml` (17 files) | DELETE. | SK-2 |
| `optional_plugins/*/.claude-plugin/plugin.json` (7 files) | Add `"version"`. manuscript: drop "and glossary extraction" from description (+ marketplace.json mirror); skills list drops business-analyst. | SK-14, SK-10, SK-9 |
| `.claude-plugin/marketplace.json` | Mirror manuscript description; verify 7/7 still resolve. | SK-10 |
| MOVE `optional_plugins/manuscript/skills/business-analyst/` → `skills/business-analyst/` | `git mv`; rewrite description in house pattern ("Use whenever… Trigger when… Do NOT use for…"). | SK-9, SK-13 |
| `optional_plugins/manuscript/skills/manuscript-review/SKILL.md` | Rewrite description in house pattern (keep `model: claude-sonnet-5`). | SK-13 |
| `skills/python-patterns/SKILL.md:3` | Fix "Python 3.12 syntax" → "CPython ~3.9 with stdlib only; refer to python-rhino-grasshopper". | SK-1 |
| `skills/skill-creator/` (13 files) | DELETE (plugin is canonical). | SK-11, SK-15 |
| `skills/project-planner/SKILL.md` | Rename duplicate heading :194 → "Task Type Vocabulary"; replace ROI-Escalation + Interface-First restatements (:22-28,:56-59) with one-line pointers to CLAUDE-global. | SK-6, SK-7 |
| `skills/codebase-navigator/SKILL.md`, `skills/glossary-extraction/SKILL.md` | Append "Do NOT use…" boundaries per AUDIT_REPORT SK-17 suggestions. | SK-17 |
| `optional_plugins/visual-storytelling/skills/pptx-slide-design/SKILL.md:139` | Path → relative `references/`. | SK-16 |
| 3 plugin skills lacking explicit override `model:` (python-rhino-grasshopper, systematic-debugging, doc-updater) | Add `model:` matching model-routing table ("all four or none" — choose all). | SK-18 |
| All SKILL.md with non-spec keys (37 occurrences) | `tags`/`globs`/`verbosity_control` → under `metadata:`; delete `auto_activate`. | SK-19 |
| `rules/common/TOKEN-ECONOMICS.md` | L0 abstracts mandatory only for skills > 150 lines. | SK-5 |
| 6 new `abstract.md` files | dax-modeling, python-patterns, doc-updater, rhino-e2e-testing, pptx-slide-design, powerbi-report (~100-300 tokens each, mirror existing abstract style). | SK-5 |
| testing-strategy.md ↔ verification-gate ↔ TDD skill | Boundary pass: testing-strategy keeps lanes + evidence taxonomy; delete its TDD-loop §4 duplication in favor of a pointer to the TDD skill; skills point back for lane selection. Minimal diffs. | SK-8 |

### C. Command consistency

| File | Edit | Findings |
|:---|:---|:---|
| all 13 arg-taking commands | Add `Target: $ARGUMENTS` (or `$1` for /deck) consumption line. | CM-9 |
| `/explain`, `/snapshot`, `/sync` (+ other read-only) | `allowed-tools: Read, Grep, Glob` frontmatter; add `model:` per routing table to all 22 (haiku: sync/clean/handoff/learn/ingest/docs/explain/script/pack; opus: blueprint/council/grill; sonnet: rest). | CM-10 |
| `commands/skill-graph.md` | Scan `skills/` + `optional_plugins/*/skills/`; `/graduate` approval → user approval (:12,:89); trim duplicated Example Output (:97-129). | CM-13, CM-28 |
| `commands/graduate.md:30` | Destination → `CLAUDE-global.md` (+ GEMINI.md mirror note). | CM-14 |
| `commands/blueprint.md` | Add Phase-N-Plan.md + Phase-N-TODO.md creation to New-Project/New-Phase steps (:24,:32); add the ≥50-line /grill Gate-1 trigger. | CM-16, CM-17 |
| `commands/sync.md:12` | "if `learnings/HOT.md` missing, skip to category indexes"; /learn gains HOT.md bootstrap in its edge case. | CM-18 |
| `commands/learn.md` | Align example labels with category enum (:22 vs :41-50). | CM-21 |
| `commands/clean.md` | Temp purge into propose-then-confirm flow + "not during active high-rigor phase" guard (:12,:17). | CM-22 |
| `commands/registry-audit.md:8`, `commands/grill.md:8` | Owner strings match registry. | CM-23 |
| `commands/handoff.md:49` | Drop/mark-Gemini-only the `IsArtifact` mirroring step. | CM-24 |
| `commands/council.md:13` | Add missing-COUNCIL_PROTOCOLS fallback (default fleet :16). | CM-26 |
| grill/triage/registry-audit | Normalize headers to plain house style. | CM-27 |

## Dependencies

**Prerequisites:** OSH-2 (agent files consistent), OSH-3 (names settled — this phase's registry edits use canonical names).
**Enablements:** OSH-5 dedup deletes duplicates against the now-correct CLAUDE-global master; OSH-6 script fixes (skill-graph scan) pair with CM-13's command text.

## Verification

- `grep -rn "ms-office-core\|visual-storytelling-core" skills/ optional_plugins/ CLAUDE*.md rules/` → 0.
- `Glob optional_plugins/**/METADATA.yaml` → 0 files. `Glob skills/skill-creator/**` → 0.
- `python -c "import json;[json.load(open(p)) for p in [...7 plugin.json...]]"` → all parse, all have version.
- Frontmatter parse check on every edited SKILL.md + command file.
- Registry cross-check: every command/skill/agent named in CLAUDE-global exists on disk; every commands/*.md is in the table (this is /registry-audit's job — run it as the phase gate).

## Hard Rules (Auditor Rejects on Violation)

1. **No description weakening**: rewritten descriptions must preserve every existing trigger/boundary and add the missing ones — nothing dropped.
2. Deletions limited to the enumerated list (17 METADATA.yaml, skills/skill-creator/, auto_activate keys); anything else is scope violation.
3. Every registry row added/edited must name an on-disk entity (verify with Glob before writing).

## Success Metrics

- [ ] `/registry-audit` run passes with zero broken references (fresh evidence)
- [ ] 0 METADATA.yaml; 7/7 plugin.json with version; marketplace mirrors
- [ ] All 22 commands carry model + (where applicable) allowed-tools + $ARGUMENTS anchor
- [ ] business-analyst core; skill-creator single-sourced; python-patterns 3.9 correct
- [ ] Deploy passes; auditor PASS
