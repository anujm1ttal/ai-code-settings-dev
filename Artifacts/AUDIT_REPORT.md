# Audit Report — OS Setup Best-Practices Audit (Initiative OSH)

**Date:** 2026-07-07 · **Auditor:** 6 parallel read-only subsystem audits + synthesis
**Scope:** agents/, commands/, skills/, optional_plugins/, hooks/, rules/common/, templates/, scripts/, CLAUDE-global.md, CLAUDE.md, Artifacts/ hygiene, repo↔`~/.claude` drift
**Verdict:** Architecture sound; enforcement layer largely non-functional; systemic naming drift; ~30% always-loaded token waste.
**Counts:** 3 CRITICAL · 27 HIGH · ~40 MEDIUM · ~30 LOW/INFO
**Remediation:** `Artifacts/Plans/OSH-1..6` (see `Artifacts/TODO.md` → Initiative OSH)

Finding IDs are stable references used by the OSH phase plans. Do not renumber.

---

## 1. Hooks (HK) — Enforcement Layer

API facts verified against official Claude Code hooks documentation.

| ID | Sev | Location | Defect → Fix |
|:--|:--|:--|:--|
| HK-C1 | CRITICAL | `hooks/guard-paths.js:92-98`, `hooks/guard-commands.js:60-67` | Deny reason printed to **stdout** with exit 2; on exit 2 only **stderr** reaches Claude, and the JSON shape (`decision`/`message`) is not a recognized schema. Blocks work but Claude never sees why → blind retries. Fix: write reason to stderr + exit 2, **or** emit `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"..."}}` + exit 0. One mechanism, not a hybrid. |
| HK-C2 | CRITICAL | `hooks/session-boot.js:128-133` | Emits top-level `additionalContext` — dropped by harness. SessionStart context requires the `hookSpecificOutput.hookEventName: "SessionStart"` wrapper. The flagship state-recovery hook currently injects **nothing**. |
| HK-C3 | CRITICAL | `hooks/auto-lint.js:107-117` | Same wrapper defect on PostToolUse; lint reports never reach Claude. Fix: `hookSpecificOutput.hookEventName: "PostToolUse"` wrapper. |
| HK-H1 | HIGH | `hooks/settings-template.json:27` + live settings | guard-commands matcher is `"Bash"` only — the separate **PowerShell tool** (primary shell on this machine) bypasses the guard. Fix: matcher `"Bash|PowerShell"` + PowerShell-native patterns (`Remove-Item -Recurse -Force`, `rd /s /q`, `Format-Volume`). |
| HK-H2 | HIGH | `scripts/deploy.sh` (no hooks step); `~/.claude/hooks/` empty | Hooks are never deployed; live `settings.json` executes the **dev working copy** directly — contradicts CLAUDE.md's "no edit is live until deploy" law. Fix: deploy `hooks/` to `~/.claude/hooks/` and repoint settings.json. (= TL-H3) |
| HK-H3 | HIGH | `hooks/session-boot.js:59` | Reads dead path `Artifacts/LEARNINGS.md`; registry is `Artifacts/learnings/index.md`. Learnings never injected even after HK-C2 fix. Fix: read `learnings/index.md`, fall back to legacy file. |
| HK-H4 | HIGH | `hooks/guard-commands.js:21` | `--force(?!-with-lease)` misses `git push -f`; `git reset --hard` absent despite security.md mandating confirmation for it. |
| HK-M1 | MED | `hooks/settings-template.json:10,23,33,44,54` | `timeout` values are milliseconds-style (`5000`, `20000`) but the field is **seconds** — `20000` ≈ 5.5 h. Fix: `5`, `3`, `20`. |
| HK-M2 | MED | `hooks/guard-commands.js:30` | Fork-bomb regex has unescaped `()` (empty capture group) — never matches an actual fork bomb. Escape the parens. |
| HK-M3 | MED | `hooks/guard-commands.js:13-16` | rm-guard gaps: root-glob variants, Windows drive roots (`rm -rf C:/`), `rd /s /q`, reversed `del /q /s` unmatched. Anchor on semantic target, not one literal spelling. |
| HK-M4 | MED | `hooks/guard-paths.js:54,61-64` | Substring false positives: `/${segment}` prefix-match blocks `src/secretsauce.py`, `docs/credentials-guide.md`; `parts.includes('bin')` blocks any legit `bin/` scripts dir. Require full segment match; scope bin/obj to compiled contexts. |
| HK-M5 | MED | `hooks/audit-trail.js:14-25,49-51,60` | No rotation (475 KB already); creates `Artifacts/.agent/` in ANY git repo (litters foreign repos). Fix: size-based rotation (~5 MB); only log when `Artifacts/` already exists. |
| HK-M6 | MED | template vs live settings | audit-trail matcher `"*"` (template) vs `""` (live) — functionally same, but source/production drift. Solved by HK-H2 deploy step. |
| HK-L1 | LOW | `hooks/auto-lint.js:123` | catch label says `[claude-code/audit-trail]` — copy-paste; misdirects debugging. |
| HK-L2 | LOW | `hooks/session-boot.js:15-25` vs comments :52,58,64 | `lines.slice(0, maxLines)` takes FIRST N lines of append-at-bottom files — injects the *oldest* content while comments claim "last N". Tail, not head. |
| HK-L3 | LOW | `hooks/auto-lint.js:45` | `where ${cmd}` is Windows-only; silently disables ruff on macOS/Linux. Use platform switch. |
| HK-L4 | LOW | `hooks/settings-template.json` (all 5 commands) | `node` assumed on PATH; if absent, all guards fail open silently. Consider absolute path or wrapper. |
| HK-L5 | LOW | `hooks/auto-lint.js:19,34` | Unquoted-safe but shell-interpolated file path in execSync; use `execFileSync` args. |
| HK-I1 | INFO | `hooks/session-boot.js:107` | `AGENT_ROLE` branch is dead code — nothing sets it. |
| HK-I2 | INFO | `hooks/session-boot.js:19` | `split('\n')` leaves trailing `\r` (CRLF) in injected briefs. |
| HK-I3 | INFO | `hooks/session-boot.js:65` | Reads `Artifacts/DECISION_LOG.md` root — breaks if archived per CLAUDE-global's (wrong) placement. See RU-F3. |
| HK-I4 | INFO | session-boot.js | Doesn't read `Artifacts/HANDOFF_BRIEF.md` — arguably the highest-value boot file. |
| HK-G1..G4 | BACKLOG | coverage gaps | No Stop/SubagentStop hook (nudge /handoff); no PreCompact hook (60%-context protocol); no scratch-dir hard-gate enforcement; no commit-trailer guard (`Co-Authored-By: Claude`). New features → separate Step 0; filed to BACKLOG. |

**Verified good:** fail-open is real in all 5 scripts (try/catch → exit 0, incl. stdin/JSON-parse); guard-paths normalizes backslashes + case; `.env.example` correctly not blocked; `--force-with-lease` carve-out correct; audit-trail logs lengths not contents; auto-lint honestly report-only.

---

## 2. Agents (AG)

| ID | Sev | Location | Defect → Fix |
|:--|:--|:--|:--|
| AG-1 | HIGH | `agents/auditor.md:4-5` vs `:14` | Self-contradiction: "Read-only" agent (tools: Read, Grep, Glob, Bash) is mandated to write `AUDIT_REPORT.md` + mark `TODO.md [x]` (orchestration fleet table agrees it writes). Fix: add `Edit, Write` and drop "Read-only" phrasing (recommended), aligning description, body, and orchestration.md. |
| AG-2 | HIGH | `agents/council.md:5` vs `:45` | Council owns `Artifacts/DECISION_LOG.md` but has no Write tool. Fix: add `Write, Edit`, or reword ownership to "produces entry text; concierge persists". Recommended: add Write. |
| AG-3 | HIGH | `agents/auditor.md:22` | Mandatory dispatch of nonexistent `visual-auditor` subagent, with a hard "forbidden to approve without its PASS" gate. Fix: dispatch `subagent_type: auditor` equipped with `visual-composition` skill. |
| AG-4 | HIGH | `agents/coder.md:44`, `agents/auditor.md:30` | Hard gates reference `skills/python-rhino-grasshopper/resources/` — moved to `optional_plugins/geometry/skills/python-rhino-grasshopper/resources/`. Also `grep_search` is not a Claude Code tool name (use Grep). Fix both paths + note plugin-presence condition. |
| AG-5 | MED | `agents/strategist.md:4` | Router-facing description names nonexistent `Artifacts/PLAN.md`; canonical is `IMPLEMENTATION_PLAN.md` (strategist.md:69 itself agrees). |
| AG-6 | MED | `agents/auditor.md:40` | "Dispatch a `scribe` subagent using `subagent_type: auditor`" — contradictory. Pick `subagent_type: scribe` (matches clean-room goal), delete the other half. |
| AG-7 | MED | `agents/auditor.md:95` | Phantom skill `csharp-grasshopper` (also in commands/audit.md:34, business-analyst SKILL.md:111). Point at `python-rhino-grasshopper`. |
| AG-8 | MED | `agents/council.md:14`, abstract :6,:10 | Claims "final architectural authority"; orchestration + CLAUDE-global give that to strategist. Fix: council produces *consensus recommendation*; strategist retains authority. |
| AG-9 | MED | `agents/concierge.abstract.md:8` | Says concierge maintains `Artifacts/LEARNINGS.md` + `DECISION_LOG.md` — both wrong (learnings/ dir; DECISION_LOG is council's). |
| AG-10 | MED | `agents/concierge.md:42-47` | Owned Commands omits `/clean` and `/graduate`. |
| AG-11 | MED | `agents/strategist.md:16` | "Required Skill" `business-analyst` lives in the manuscript plugin — unavailable unless an unrelated plugin is installed. Fix: promote to core `skills/` (see SK-9) or mark "when available". |
| AG-12 | MED | fleet registries | `geometry-validator` in orchestration Model Routing + agents.overview, but absent from orchestration Fleet table, CLAUDE-global Agents table, model-routing YAML. Add rows or label "dispatched subagent, not routed fleet". |
| AG-13 | MED | scribe/strategist/concierge/creative-director `:5` | Maintainer agents have `Write` but not `Edit` — every update is a full rewrite, violating standards.md Diff Protocol. Add `Edit` to all four. |
| AG-14 | LOW | `agents/auditor.md:55-57`, `agents/concierge.md:13-15` | Orphaned one-row fleet-table copy-paste fragments. Delete. |
| AG-15 | LOW | `agents/agents.overview.md:7-14` | Hardcoded `file:///c:/Users/44547/...` links — break after deploy and on other machines. Use relative links. |
| AG-16 | LOW | `agents/auditor.md:127-129` | Severity scale truncated (missing LOW/INFO); reference orchestration's scale instead of redefining subset. |
| AG-17 | LOW | `agents/coder.md:59` | Code-change subagents routed to `general-purpose`; use `subagent_type: coder` (keeps model binding + boundaries). |
| AG-18 | LOW | `agents/concierge.md:34` | `/deck` ownership drift (see CM-5/RU-F7). |
| AG-19 | LOW | `agents/geometry-validator.md:19,25` | "the resource directory" unnamed (give plugin path); "closed (is_manifold)" conflates `Brep.IsSolid` (closure) vs `IsManifold`. Split the checks. |
| AG-20 | LOW | `agents/scribe.md:25` vs :27,:45 | "All .md MUST be in Artifacts/" stated without the root-README exception scribe itself owns. Append exception. |
| AG-21 | INFO | all 8 frontmatters | Non-standard keys `role:`, `effort:`, `reasoning_depth:` are ignored by the harness — self-documentation only; effort must come from caller. |
| AG-22 | INFO | model IDs | 8/8 agents on correct tier vs model-routing.md (verified). Consider harness aliases (`opus`/`sonnet`/`haiku`) for rotation resilience. |

**Verified good:** router-grade descriptions ("Use PROACTIVELY"/"MUST BE USED") on all 8; model routing 100% consistent; abstracts genuinely L0 (~10 lines); overview complete; geometry-validator's explicit output format is a pattern worth copying.

---

## 3. Commands (CM)

| ID | Sev | Location | Defect → Fix |
|:--|:--|:--|:--|
| CM-1 | HIGH | `commands/audit.md:21,36` | /audit instructs auditor to append Action Items to `TODO.md` — orchestration authority table forbids auditor adding tasks. Fix: write to `AUDIT_REPORT.md`/`BACKLOG.md`, flag for strategist. |
| CM-2 | HIGH | `rules/common/orchestration.md:72-87` | Command Fleet table lists 14/22 commands (missing /deck, /ideate, /script, /pack, /claude-md; /docs, /explain, /triage only in prose). Fix via registry consolidation (see RU-D2). |
| CM-3 | HIGH | `commands/script.md:20`, `commands/pack.md:12,26` | Write `script.md`/`metadata.md` at repo root; gates require `Artifacts/SCRIPT.md`. /pack's precondition can never match its own registry gate. Standardize `Artifacts/SCRIPT.md` + `Artifacts/METADATA.md`. |
| CM-4 | HIGH | `commands/learn.md:2` (+ orchestration :18,:85, concierge.abstract) | Dead `Artifacts/LEARNINGS.md` in frontmatter description (shown to every session); body correctly uses `learnings/`. Fix all refs (see RU-F1). |
| CM-5 | HIGH | `commands/deck.md` vs CLAUDE-global:48 | Owner mismatch: registry "strategist / creative-director" vs file "concierge (init), coder (build), auditor (audit)". Align registry to file. |
| CM-6 | HIGH | `commands/audit.md:34` | Phantom skill `csharp-grasshopper` (= AG-7). |
| CM-7 | HIGH | `commands/deck.md:42` | `/deck audit` body has no heading — orphaned under `/deck build`. Insert `### /deck audit [--team]` + Agent: auditor. |
| CM-8 | HIGH | `commands/registry-audit.md:17,22,40` | References nonexistent `global_workflows/`; never audits CLAUDE-global.md; writes report to CWD (violates Artifacts hard-gate). Fix all three. |
| CM-9 | MED | all 22 files | No `$ARGUMENTS`/`$1` anchors despite 13 commands declaring `argument-hint`. Add explicit `Target: $ARGUMENTS` consumption line. |
| CM-10 | MED | all 22 files | No `allowed-tools`/`model` frontmatter; read-only promises (/explain, /snapshot, /sync) unenforced; model-routing tiers unexpressed. Add `allowed-tools: Read, Grep, Glob` to read-only commands; add `model:` per routing table. |
| CM-11 | MED | `commands/audit.md:41` | "Spawn a `scribe` subagent with `subagent_type: auditor`" (= AG-6 twin). Pick one. |
| CM-12 | MED | `commands/snapshot.md:12`, `registry-audit.md:37-38` | Non-Claude-Code tool names `grep_search`/`list_dir` (Windsurf/Gemini carryover). Rename to Grep/Glob or tool-neutral wording. |
| CM-13 | MED | `commands/skill-graph.md:12,89` | Scans only `skills/` (misses 17 plugin skills → drops youtube/geometry/pptx clusters); "requires `/graduate` approval" is wrong command. Scan both roots; replace with user approval. |
| CM-14 | MED | `commands/graduate.md:30` | Tier-bleed destination "Root CLAUDE.md or GEMINI.md" — global changes go to `CLAUDE-global.md`. |
| CM-15 | MED | `commands/handoff.md:48,54` vs CLAUDE-global:135-139 | Two competing archive schemes (`history/TODO_phase_[n].md` vs `History/Plans/Phase-N-Plan.md`). Standardize (see RU-F4). |
| CM-16 | MED | `commands/blueprint.md:24,32` | /blueprint never creates the `Phase-N-Plan.md`/`Phase-N-TODO.md` files CLAUDE-global mandates at phase start. Add creation steps. |
| CM-17 | MED | `commands/grill.md:50` | "Mandatory Gate 1 for any blueprint over 50 lines" — blueprint.md has no such trigger. Add the gate to blueprint.md (recommended) or soften. |
| CM-18 | MED | `commands/sync.md:12` | Depends on `Artifacts/learnings/HOT.md` that nothing creates. Define bootstrap in /learn, or "if missing, skip" in sync. |
| CM-19 | MED | `commands/audit.md:139-145` | Stale "Skill Registry Consistency" section (checks GEMINI.md only; duplicates /registry-audit). Delete; reference /registry-audit. |
| CM-20 | LOW | `commands/learn.md:25` | Hardcoded `c:\Users\44547\...GLOBAL_INBOX.md` machine path. |
| CM-21 | LOW | `commands/learn.md:22` vs :41-50 | Category enum (`patterns|anti-patterns|project-notes|execution-rules`) vs example labels (`gotcha:`/`preference:`/`mistake:`) mismatch. Align. |
| CM-22 | LOW | `commands/clean.md:12` vs :17 | Temp purge unconditional before confirmation step; collides with high-rigor evidence namespace. Fold into propose-then-delete + active-phase guard. |
| CM-23 | LOW | `registry-audit.md:8`, `grill.md:8` | Owner strings drift from registries (Auditor/Strategist vs auditor; strategist/council vs strategist). |
| CM-24 | LOW | `commands/handoff.md:49` | `IsArtifact: true` / brain-directory mirroring is a non-Claude-Code (Windsurf/Gemini) concept — token-costing no-op here. Mark Gemini-only or drop. |
| CM-25 | LOW | `commands/script.md:23` | References nonexistent `/review` command. Use /audit. |
| CM-26 | LOW | `commands/council.md:13` | Hard dependency on per-project `COUNCIL_PROTOCOLS.md` with no missing-file fallback. State default-fleet fallback. |
| CM-27 | INFO | grill/triage/registry-audit | Emoji-header style split vs 19 plain-header files. Pick house style. |
| CM-28 | INFO | `commands/skill-graph.md:97-129` | Example Output restates Report Format (~30 lines). Trim. |
| CM-29 | INFO | pack/script/ideate | Owner named in prose only, no frontmatter — consistent but implicit. |

**Verified good:** uniform description+argument-hint frontmatter; registry complete on owners 21/22; explicit "Does NOT" boundaries in sync/handoff/explain/skill-graph (mandate for the rest); real gates where they matter; crisp audit-family separation; consistent severity vocabulary.

---

## 4. Rules corpus (RU) — 1,875 always-loaded lines

### Contradictions & naming drift

| ID | Sev | Defect → Fix |
|:--|:--|:--|
| RU-F1 | HIGH | `LEARNINGS.md` vs `learnings/`: orchestration.md self-contradicts (:18,:85,:257 vs :212,:329). Also concierge.abstract.md:8, learn.md:2 frontmatter. Fix: `Artifacts/learnings/` everywhere. |
| RU-F2 | HIGH | Two incompatible Findings protocols: TOKEN-ECONOMICS:50-53 (`Artifacts/findings.md`, promoted at `/sync`) vs orchestration:327-329 + high-rigor:99 (`BACKLOG.md`, promoted at `/handoff`). Fix: rewrite TOKEN-ECONOMICS section to point at BACKLOG + /handoff. |
| RU-F3 | HIGH | CLAUDE-global:135-137 files `DECISION_LOG.md` under Archive (`History/`); orchestration:210, security.md:66, corruption-recovery treat it as live root. Fix: move to Root Files list. |
| RU-F4 | MED | `Artifacts/History/` vs `history/` casing (CLAUDE-global:135 vs :181, orchestration ×4, CLAUDE.md:65) + conflicting archive naming (`History/Plans/Phase-N-Plan.md` vs `history/PLAN_Phase_[N].md`). **Both casings are git-tracked** (TL-H5). Fix: standardize `History/` + one scheme; `git mv`. |
| RU-F5 | MED | `Artifacts/PLAN.md` stale in strategist description (= AG-5). |
| RU-F6 | MED | geometry-validator missing from fleet tables (= AG-12). |
| RU-F7 | MED | `/deck` ownership three ways (= CM-5). |
| RU-F8 | LOW | `/grill` owner: strategist vs "strategist or council". |
| RU-F9 | LOW | orchestration:161 cites "Approval Label Rubric"; standards.md heading is "Approval Rubric". |
| RU-F10 | LOW | `/handoff` write target ambiguous: "Writes to `Artifacts/history/`" vs HANDOFF_BRIEF at root. |
| RU-F11 | INFO | Fleet says scribe writes "All Markdown in Artifacts/" — over-broad vs persistence table (HANDOFF_BRIEF/LAYOUT_SPEC/DECISION_LOG owned elsewhere); `AUDIT_REPORT.md` has no persistence-table row. |
| RU-F12 | INFO | TOKEN-ECONOMICS.md odd ALL-CAPS filename; typo "token Estimate" at :9. |

### Duplication (RU-D) — ≈230–280 duplicated lines (12–15% of corpus)

| ID | Content | Copies | Canonical home |
|:--|:--|:--|:--|
| RU-D1 | Model/agent routing + cost figures | model-routing §1-2, orchestration:24-52, CLAUDE-global | model-routing.md; orchestration keeps 1-line pointer |
| RU-D2 | Command registry | CLAUDE-global table + orchestration:72-87 + Concierge-Ops re-descriptions + duplicate `/learn` row inside CLAUDE-global | One registry (CLAUDE-global); orchestration keeps routing prose |
| RU-D3 | Project-type routing table | CLAUDE-global + orchestration (near-identical) | orchestration.md |
| RU-D4 | Artifacts persistence layout | CLAUDE-global:113-155 + orchestration:192-232 | orchestration.md; CLAUDE-global 3-line pointer |
| RU-D5 | Mirroring Rule | **twice within standards.md (:39, :46)** + CLAUDE-global:157-162 + orchestration:197 | once, standards.md |
| RU-D6 | Learnings lifecycle | CLAUDE-global:171-186 + orchestration row + concierge.md | one place |
| RU-D7 | No-Fluff bullets | standards.md Behavioral-Personality vs Ruthless-Communication | merge |
| RU-D8 | Status vocabulary | standards.md vs orchestration Taxonomies §1 | one table |
| RU-D9 | High-rigor summary | orchestration:127-146 restates high-rigor bullets | pointer only |
| RU-D10 | Routing-lookup script commands | orchestration:45-51 + model-routing + CLAUDE.md | repo CLAUDE.md only (dev commands = tier-bleed in global) |

### Token economy (RU-T)

| ID | File | Assessment |
|:--|:--|:--|
| RU-T1 | model-routing.md (263 ln) | ~40 lines behavioral; cost tables, decision tree, YAML pseudo-config, cost-monitoring template, dated verification anecdote = documentation. Cut to ~40-line rule; docs → `scripts/README.md`. |
| RU-T2 | high-rigor-engineering.md (349 ln) | Conditional workflow, always loaded. Convert to on-demand skill; orchestration's 15-line pointer suffices. |
| RU-T3 | TOKEN-ECONOMICS.md | Bootstrap-cost tables are self-referential narration; actionable content ~20 lines. |
| RU-T4 | Combined | Realistic reduction ~550–650 lines (~30–35%) with no behavioral loss. |

### Precedence (RU-P)

| ID | Pair | Status |
|:--|:--|:--|
| RU-P1 | coding-style vs standards | ✅ stated bidirectionally — the model to copy |
| RU-P2 | high-rigor vs orchestration | ⚠️ "variant of" but no conflict-winner (e.g. phase-branch merge vs one-commit-per-phase) |
| RU-P3 | orchestration vs model-routing | ❌ silent (both carry "mandatory" tables) |
| RU-P4 | CLAUDE-global vs rules/common/* | ❌ silent — fails its own D6 |
| RU-P5 | Global vs project CLAUDE.md | ❌ general rule stated nowhere |

### Staleness & compliance (RU-S)

| ID | Finding |
|:--|:--|
| RU-S1 | Manifest system: CLEAN — zero lingering references. All referenced scripts/pointers exist; model IDs consistent incl. `model_router.py`. |
| RU-S2 | high-rigor footer ("Last updated… Superseded by: None") + model-routing 2026-07-06 anecdote = changelog content in always-loaded rules. |
| RU-S3 | Hardcoded `file:///c:/Users/44547/...` links in coding-style.md (testing-strategy link) + agents.overview.md; `c:\Users\...GLOBAL_INBOX.md` in orchestration:256. Deployed copies point back at dev repo. Use relative refs. |
| RU-S4 | **CLAUDE-global.md scores 6/12 with two zeros** vs claude-md-standards §4 (D2=0 rule-echo, D6=0 no precedence; D4=1 missing geometry-validator + lists 5/10 rules; D5=1 duplicate /learn row). 203 lines (D1 ✅). Repo CLAUDE.md: **12/12** — the model. |
| RU-S5 | Repo↔deployed rules in sync except CRLF-only diff in claude-md-standards.md. |

---

## 5. Skills & plugins (SK)

Inventory: 14 core skills (not 17), 17 plugin skills across 7 plugins. No SKILL.md > 337 lines; all descriptions < 1024 chars.

| ID | Sev | Location | Defect → Fix |
|:--|:--|:--|:--|
| SK-1 | HIGH | `skills/python-patterns/SKILL.md:3` | Description says Rhino-internal scripts "follow Python 3.12 syntax" — coding-style matrix + sibling skill mandate CPython **3.9**. Wrong-lane trigger risk, in always-loaded picker text. Fix: "…run CPython ~3.9 with stdlib only; refer to python-rhino-grasshopper." |
| SK-2 | HIGH | all 17 `optional_plugins/*/skills/*/METADATA.yaml` | Vestigial retired-manifest layer; plugin README says the layer doesn't exist; nothing loads them; confirmed version drift ×3 (rhino-e2e-testing 1.1.0 vs 1.0.1; pptx-slide-design 2.0.0 vs 1.0.0 + stale pre-v2 description; banana-prompt 1.0.1 vs 1.0.0); dead `min_os_version` field. Fix: delete all 17 (add `version` to plugin.json — SK-14). |
| SK-3 | HIGH | `skills/skills.overview.md:29,41` | Ghost plugin names `ms-office-core` / `visual-storytelling-core` — actual plugin.json names are `ms-office` / `visual-storytelling`; these are the exact `enabledPlugins` values a user would copy. |
| SK-4 | MED | `skills/skills.overview.md:31-34` | Empty "Domain: Geometry" table with no redirect note (unlike the other moved sections). Add pointer to `optional_plugins/geometry/`. |
| SK-5 | MED | 9/14 core + 17/17 plugin skills | Missing L0 `abstract.md` mandated by TOKEN-ECONOMICS "Mandatory Query Flow" — OS violates own standard 26/31 times. Fix: amend the rule (L0 optional below size threshold) + write abstracts for the largest skills. |
| SK-6 | MED | `skills/project-planner/SKILL.md:120,194` | Duplicate `### Task Briefing Patterns` heading, different content. Rename second (e.g. "Task Type Vocabulary"). |
| SK-7 | MED | `skills/project-planner/SKILL.md:22-28,56-59` | Rule-echo of CLAUDE-global's ROI Escalation + Interface-First verbatim. Replace with pointers. |
| SK-8 | MED | verification-gate + test-driven-development + testing-strategy.md | Three-way overlap on evidence rules + TDD loop. Fix: testing-strategy owns lanes + evidence taxonomy; skills own behavioral loops; cross-reference. |
| SK-9 | MED | `optional_plugins/manuscript/` | `business-analyst` is a strategist ROI skill with zero manuscript content, gated behind the manuscript plugin (manuscript routing never includes it). Move to core `skills/` (= AG-11); update rosters. |
| SK-10 | MED | `manuscript/.claude-plugin/plugin.json:3` + marketplace | Claims "glossary extraction" — that skill is core, not in this plugin. Drop the claim. |
| SK-11 | MED | `skills/skill-creator/` | Byte-identical duplicate of the installed `skill-creator` plugin (Apache-2.0 vendored copy) — loaded twice, ambiguous triggering, drifts stale. Delete core copy; update overview + CLAUDE-global row. |
| SK-12 | MED | CLAUDE-global registry | Unregistered skills: `test-driven-development`, `receiving-code-review` (belong in foundational list), `pptx-slide-design`, `docx`, `xlsx`. Add. |
| SK-13 | MED | business-analyst + manuscript-review SKILL.md:3 | Weakest descriptions in fleet: passive voice, no trigger conditions, no Do-NOT boundary. Rewrite in house pattern. |
| SK-14 | LOW | all 7 `plugin.json` | No `version` field (versioning lived only in doomed METADATA.yaml). Add `"version"`. |
| SK-15 | LOW | `skills/skill-creator/SKILL.md:1-4` | Nonconforming frontmatter, no `license:` key despite bundled LICENSE.txt. Moot if SK-11 delete taken. |
| SK-16 | LOW | `pptx-slide-design/SKILL.md:139` | Self-referencing path omits `skills/` segment. Make relative (`references/`). |
| SK-17 | LOW | codebase-navigator + glossary-extraction :3 | Only core skills lacking "Do NOT use" boundaries; glossary-extraction shortest description in fleet. Append boundaries. |
| SK-18 | LOW | model-routing override table | Of 4 "maintain" overrides only typescript-mcp carries explicit `model:`; upgrades wired correctly. All four or none. |
| SK-19 | LOW | 37 occurrences | Non-spec frontmatter keys (`auto_activate`, `verbosity_control`, `tags`, `globs`) have no runtime effect; `cd-foundations` `auto_activate: true` falsely implies implementation. Move under `metadata:` or delete; document as aspirational. |
| SK-20 | INFO | inventory | Core skill count is 14 (registries citing 17 conflate plugin count). |
| SK-21 | INFO | verified | All referenced support/reference files exist (implementation-dispatch prompts, 11 plugin skills' references/, etc.). |
| SK-22 | INFO | verified | marketplace.json fully current (7/7, paths resolve, descriptions match); index.md matches filesystem exactly. |

**Verified good:** 26/31 descriptions follow house trigger pattern with paired-skill boundaries; progressive disclosure genuinely practiced (Deep-Load Protocol tables); verification-gate/TDD/receiving-code-review form a coherent enforcement triad; doc-updater vs /docs is a model command/knowledge split.

---

## 6. Tooling & hygiene (TL)

| ID | Sev | Location | Defect → Fix |
|:--|:--|:--|:--|
| TL-H1 | HIGH | `scripts/model_router.py:52,184` | Only scans `skills/` — plugin-hosted overrides invisible. **Verified wrong answer**: `manuscript-review` returns haiku; mandated override is sonnet. Fix: second lookup root `optional_plugins/*/skills/`, or parse frontmatter live like model_routing_audit.py. |
| TL-H2 | HIGH | `scripts/deploy.sh:125` vs CLAUDE.md + DEPLOY.md:39 | deploy.sh **does** copy `optional_plugins/` to `~/.claude/optional_plugins/` (dead weight; real installs live in `~/.claude/plugins/`); three docs claim it doesn't. Fix: drop from copy loop + remove deployed copy, or correct docs. Recommended: drop. |
| TL-H3 | HIGH | live settings + deploy.sh | Hooks bypass deploy gate entirely (= HK-H2). |
| TL-H4 | HIGH | `Artifacts/` root | ~14 files violate the OS's own archive policy: PHASE_11_* ×3, SKILL_AUDIT/REGISTRY/OPTIMIZATION ×3, REGISTRY_HEALTH_REPORT, NEXT_SESSION_*, SNAPSHOT, WALKTHROUGH ×2, anthropic_skills_analysis, ROLLBACK_PROCEDURE, task.md (stale since May 1; rules place pointer at `.agent/current_task.md`); unrecognized empty `SESSIONS/`. Archive sweep → `Artifacts/History/`. |
| TL-H5 | HIGH | git index | **Both `Artifacts/History/` and `Artifacts/history/` are tracked** — merges on NTFS, splits on case-sensitive checkouts. `git mv` to one casing (pairs with RU-F4). |
| TL-M1 | MED | `tests/` | Zero test files (pytest collects 0, exit 5) while CLAUDE.md + cheatsheet.md advertise the suite. Restore minimal suite or stop advertising. |
| TL-M2 | MED | `Artifacts/Temp/scratch_test.md` | Git-tracked despite `.gitignore` (predates rule); currently uncommitted `D`. `git rm --cached` + commit. |
| TL-M3 | MED | `scripts/deploy.sh:20` | `--force` parsed, never read — dead flag documented in CLAUDE.md. Implement or remove. |
| TL-M4 | MED | `scripts/deploy.sh:109` | Backup copies ALL of `~/.claude` incl. 71 MB transcripts; 8 × ~115 MB on disk; rollback would clobber newer transcripts. Back up only deployed paths; prune to last N. |
| TL-M5 | MED | `DEPLOY.md:26-30,49-50` | References deleted `migrate_skills_to_plugins.py` / `phase_11_*.py`; manual-copy snippet reproduces the nesting bug deploy.sh fixed. Refresh to mirror deploy.sh. |
| TL-M6 | MED | `cheatsheet.md:169-183,293` | Dead migration-script ref; pytest section targets empty suite; intent table missing 9/22 commands. Refresh. |
| TL-M7 | MED | `scripts/skill_graph_analyzer.py:11,18,40,157,212` | False type annotations (`dict[...]` vs actual nested defaultdict), dead identical-branch conditional, unused imports — fails repo's own pyright-strict mandate. Also scans only `skills/` (pairs with CM-13). |
| TL-M8 | MED | CLAUDE.md commands table | `python scripts/skill_graph_analyzer.py` errors (requires root arg). Document `... .`. |
| TL-M9 | MED | `scripts/model_router.py:67-68` | `except Exception: pass` violates repo error-handling rule; AGENT_MODELS/MODEL_PRICING hardcode-duplicate model-routing.md (already drifting re geometry-validator). Parse live config (benchmark: model_routing_audit.py). |
| TL-L1 | LOW | `deploy.sh:5,61-67` | `set -e` makes the friendly pytest-failure hint unreachable. |
| TL-L2 | LOW | `deploy.sh:88-90` | Creates `$DEST/scripts` never populated — vestigial. |
| TL-L3 | LOW | disk | `__pycache__` NOT committed (gitignore correct); local ghosts of retired manifest system delete-at-will. |
| TL-L4 | LOW | `templates/Phase-N-Plan.md.template` | No Hard Rules section despite standards.md requiring 2–3 per phase. Add. |
| TL-L5 | LOW | `templates/README.md` | Omits CLAUDE.md.template. Add row. |
| TL-L6 | LOW | deploy drift | CRLF-only diffs ×2 (claude-md-standards.md, claude-md.md); content in sync 96/98 byte-identical. Consider `.gitattributes`. |
| TL-L7 | LOW | scripts | Non-frozen mutated dataclasses; `Optional[...]` vs mandated `T \| None`; two `# type: ignore`. |
| TL-L8 | LOW | `Artifacts/Plans/CMD-Plan.md` | CMD closed/merged → belongs in History/Plans/; name breaks Phase-N convention. |
| TL-I1 | INFO | env | ruff not installed though templates recommend it. |
| TL-I2 | INFO | deploy.sh step 6 | Validation is existence-only, never content-verifies (DEPLOY.md's diff spot-check is stronger). |

**Verified good:** model_routing_audit.py is the in-repo quality benchmark; deploy.sh correctness fixes landed (rm-before-cp, correct global mapping, timestamped backup); deployment genuinely in sync; CLAUDE.md.template exemplary; .gitignore correct; learnings/ + MEMORY_ANCHORS.md follow the rules.

---

## Cross-cutting themes → phase mapping

| Theme | Findings | Phase |
|:--|:--|:--|
| Enforcement layer broken | HK-C1..C3, HK-H1..H4, HK-M1..M6, HK-L*, TL-H3 | **OSH-1** |
| Broken gates / capability mismatches / dead refs | AG-1..11,13..20, CM-1,3,6..8,11,12,25 | **OSH-2** |
| State-file naming drift | RU-F1..F5,F9,F10, CM-4,15, AG-9 | **OSH-3** |
| Registry reconciliation + skill hygiene | AG-12, CM-2,5,9,10,13,14,16..23,26..28, RU-F6..F8, SK-1..19 | **OSH-4** |
| Token-economy diet + precedence | RU-D1..D10, RU-T1..T4, RU-P2..P5, RU-S2..S4, RU-F11,F12 | **OSH-5** |
| Tooling & repo hygiene | TL-H1,H2,H4,H5, TL-M1..M9, TL-L1..L8, HK-M5 | **OSH-6** |
| New hook features (deferred) | HK-G1..G4 | BACKLOG |

---

## Phase Gate: OSH-4 (Registry Reconciliation & Skill Hygiene)

**Date:** 2026-07-07 · **Branch:** `phase-osh-4-registry-skills` · **Auditor:** single-pass, fresh evidence
**Scope of this gate:** `Artifacts/Plans/OSH-4-Plan.md` Success Metrics, Hard Rules 1–3, and `/registry-audit`
run against the current working tree (staged + unstaged, no commit made).
**Verdict: FAIL** — no CRITICAL, but 3 HIGH findings block a clean gate; 2 MEDIUM + 1 LOW/INFO also filed.
**Counts:** 0 CRITICAL · 3 HIGH · 2 MEDIUM · 1 LOW/INFO
**Not evaluated (explicitly out of scope for this gate):** deploy, commit, TODO `[x]` marking — all withheld per instructions.

### Strengths (verified, not asserted)

- **Hard Rule 1 (no description weakening) — PASS.** Diffed all 4 rewritten descriptions
  (business-analyst, manuscript-review, codebase-navigator, glossary-extraction) against `git show HEAD`.
  Every trigger/boundary phrase in the original survives in the rewrite; only Do-NOT clauses and
  house-pattern structure were added. Zero drops.
- **Hard Rule 2 (deletions enumerated-only) — effectively PASS.** `git diff --stat` confirms the only
  deletions are the 17 `METADATA.yaml` files, `skills/skill-creator/` (13 files), and the described
  content trims (project-planner ROI/Interface-First → pointers, testing-strategy §4 → pointer,
  skill-graph approval fix). One file (`Artifacts/Temp/scratch_test.md`) is deleted outside the
  enumerated list — see G4-06, filed LOW as it predates this session and sits in the designated
  scratch directory.
- **Hard Rule 3 (registry rows name on-disk entities) — PASS.** Glob-verified every added row:
  `geometry-validator` (agents/CLAUDE-global/orchestration/model-routing), all 22 command files exist
  for orchestration.md's Command Fleet table, `skills/business-analyst/`, `pptx-slide-design`,
  `test-driven-development`, `receiving-code-review` all resolve on disk.
- **METADATA.yaml / skill-creator cleanup — clean.** `find optional_plugins -iname METADATA.yaml` → 0.
  `skills/skill-creator/` → does not exist. Ghost plugin names (`ms-office-core`,
  `visual-storytelling-core`) → 0 matches repo-wide.
- **Plugin manifests — correct.** All 7 `plugin.json` parse and carry a `version`. `marketplace.json`'s
  manuscript description byte-matches `plugin.json`'s (both drop "and glossary extraction").
  `optional_plugins/index.md` no longer lists business-analyst under manuscript; its skill count
  (1) is correct there.
- **Frontmatter — 100% valid.** `yaml.safe_load` on all 30 edited `SKILL.md` + all 22 `commands/*.md`
  → 0 parse failures.
- **Non-spec key migration — clean.** Zero remaining top-level `tags:`/`globs:`/`verbosity_control:`
  outside `metadata:`; zero remaining `auto_activate:` anywhere in `skills/` or `optional_plugins/`.
- **Abstracts — all 6 written, house-style.** dax-modeling, python-patterns, doc-updater,
  rhino-e2e-testing, pptx-slide-design, powerbi-report abstracts all present, all follow the
  Purpose/Core Logic/Constraint template, all well under 300 tokens.
- **Command hygiene — strong.** All 22 commands carry `model:`; the 3 designated read-only commands
  (`/explain`, `/snapshot`, `/sync`) carry `allowed-tools: Read, Grep, Glob`; exactly 13 commands carry
  a `$ARGUMENTS`/`$1` consumption anchor (the free-text/positional-arg commands — the 3 remaining
  arg-taking commands, `/blueprint --team`, `/handoff --lite|--phase`, `/skill-graph --export`, use
  named-flag dispatch instead, a defensible split since they branch on fixed exclusive flags rather
  than free text). `blueprint.md` correctly adds Phase-N-Plan/TODO creation and the ≥50-line `/grill`
  gate. `graduate.md` destination fixed to `CLAUDE-global.md` with GEMINI.md mirror note.
  `handoff.md`'s `IsArtifact` step correctly marked Gemini-only no-op. `council.md` has the missing-
  `COUNCIL_PROTOCOLS.md` fallback. Owner strings in `grill.md`/`registry-audit.md` match the registries.
- **PROJECT_TYPE enum — consistent** across `strategist.md`, `project-planner/SKILL.md`,
  `orchestration.md`, `CLAUDE-global.md` (8 types, identical order).

### Findings

| ID | Sev | Location | Defect → Fix |
|:--|:--|:--|:--|
| G4-01 | HIGH | `commands/ideate.md:4`, `commands/sweep.md:4`, `commands/skill-graph.md:4`, `commands/graduate.md:4` | CM-10's model assignment ("opus: blueprint/council/grill; sonnet: rest") contradicts `model-routing.md`'s **Hard Rule** ("Strategist always uses Opus — no exceptions"; "Concierge always uses Haiku — no exceptions"). `/ideate` and `/sweep` (strategist-owned) and `/skill-graph` (strategist-owned, and explicitly named under strategist's mandatory Opus `use_for` list in `model-routing.md:25`) are all set to `sonnet`. `/graduate` (concierge-owned) is set to `sonnet` instead of `haiku`. Fix: `/ideate`, `/sweep`, `/skill-graph` → `claude-opus-4-8`; `/graduate` → `claude-haiku-4-5`, or explicitly amend `model-routing.md`'s Hard Rules to carve out named exceptions (with rationale) before the command frontmatter can legitimately diverge. |
| G4-02 | HIGH | `skills/codebase-navigator/SKILL.md` (160 lines), `skills/project-journal/SKILL.md` (156 lines), `skills/visual-composition/SKILL.md` (193 lines) | SK-5 amended `TOKEN-ECONOMICS.md` to make an L0 abstract **mandatory** for any skill exceeding 150 lines, then wrote abstracts for only the 6 skills named in the plan. These 3 skills exceed 150 lines and were not audited against the new threshold — the rule is non-compliant in the same commit that introduces it. Fix: write `abstract.md` for all 3, or lower none of the risk by re-scoping SK-5's "6 largest lacking one" language to be threshold-driven, not a fixed list. |
| G4-03 | HIGH | `rules/common/orchestration.md:68` vs `CLAUDE-global.md:105` | CLAUDE-global.md's foundational-skills sentence was extended with `test-driven-development, receiving-code-review` (SK-12/CM-5's binding instruction); orchestration.md carries the identical-purpose sentence and was left untouched — the two files now assert different "always-on for all project types" skill sets. Since both files are positioned as canonical (CLAUDE-global.md §Architecture explicitly points to orchestration.md for "routing, lifecycle"), an agent reading orchestration.md alone will not activate TDD/receiving-code-review as foundational. Fix: add the same two skills to orchestration.md:68, or explicitly note in orchestration.md that CLAUDE-global.md is authoritative for this specific line pending OSH-5 dedup (the plan only deferred the *Command Fleet table* to OSH-5, not this sentence). |
| G4-04 | MEDIUM | `agents/strategist.md:16` | Plan's binding Technical-Approach decision (line 19) explicitly lists `strategist.md` among the files to update for the business-analyst core promotion ("'when available' → required, now core"). The file still reads: *"business-analyst — ... (core skill after OSH-4; until then available only when the manuscript plugin is installed)"* — a conditional that is now factually wrong (business-analyst is core as of this diff) and was never touched by any wave. Fix: drop the "until then" conditional entirely — business-analyst is unconditionally required. |
| G4-05 | MEDIUM | `optional_plugins/index.md:25` vs `:85` | Line 25 (Total) correctly reads "7 plugins, 16 skills" (post business-analyst move). Line 85 (Token Impact prose) still reads "instead of all **17** skills across all 7 plugins" — an internal self-contradiction introduced by this phase's own edit to line 25 without a corresponding fix to line 85. Fix: 17 → 16 on line 85. |
| G4-06 | LOW | `Artifacts/Temp/scratch_test.md` (deleted, unstaged) | Deletion falls outside Hard Rule 2's enumerated list (17 METADATA.yaml, skill-creator/, auto_activate keys, named content trims). Predates this session (present in the initial git-status snapshot before this audit began) and sits in the designated scratch directory, so risk is negligible — filed for completeness, not blocking. Fix: restore via `git checkout -- Artifacts/Temp/scratch_test.md` if unintentional, or let a `/clean` pass account for it explicitly. |

### Gate Disposition

Do **not** mark any OSH-4-TODO.md task `[x]`, do **not** deploy, do **not** commit. Return to coder for:
1. G4-01 (model-routing Hard Rule violations — 4 files)
2. G4-02 (3 skills over the new 150-line threshold lack abstracts)
3. G4-03 (orchestration.md foundational-skills line desync)

G4-04 and G4-05 are one-line fixes bundled with the same follow-up pass. G4-06 is informational only.
Re-run this gate (Hard Rules 1–3 + `/registry-audit` cross-reference) after the fix pass before
requesting deploy/commit approval.

---

## Phase Gate: OSH-4 — Final Sign-Off (post-fix re-verification)

**Date:** 2026-07-07 · **Branch:** `phase-osh-4-registry-skills` · **Auditor:** fresh evidence, this pass

**Note on provenance:** this session was briefed that "a prior scoped re-gate PASSed G4-01…G4-06,
leaving only G4-07 open." No such re-gate section existed in this file at the start of this pass —
only the FAIL gate above. Per Verification Discipline (claims are not evidence), G4-01 through G4-06
were independently re-verified here with fresh reads/greps rather than accepted on assertion:

| Finding | Fresh evidence this pass | Result |
|:--|:--|:--|
| G4-01 (model Hard Rule) | `grep model: commands/ideate.md,sweep.md,skill-graph.md` → `claude-opus-4-8`; `commands/graduate.md` → `claude-haiku-4-5` | FIXED |
| G4-02 (missing abstracts) | Read `skills/codebase-navigator/abstract.md`, `skills/project-journal/abstract.md`, `skills/visual-composition/abstract.md` — all present, house Purpose/Core Logic/Constraint template | FIXED |
| G4-03 (foundational-skills desync) | `rules/common/orchestration.md:68` now lists `test-driven-development`, `receiving-code-review` alongside CLAUDE-global.md's set | FIXED |
| G4-04 (strategist.md stale conditional) | `agents/strategist.md:16` reads `business-analyst — requirements, stakeholder mapping, ROI` — "until then available only when..." conditional removed | FIXED |
| G4-05 (index.md 17→16 self-contradiction) | `optional_plugins/index.md:25` and `:85` both now read 16 | FIXED |
| G4-06 (scratch_test.md deletion) | Unblocking per original gate (predates session, designated scratch dir) — no change needed | Unchanged, non-blocking |
| **G4-07** (skills.overview.md stale "17 skills") | Read `skills/skills.overview.md:5` — now reads "14 core skills... see `optional_plugins/index.md`" (DRY pointer, no count duplication). Repo-wide grep for "17 skills" → 0 hits in `skills.overview.md`, `optional_plugins/index.md`, `CLAUDE-global.md`, `rules/`. Remaining "17" hits confirmed confined to `README.md`, `Artifacts/MEMORY_ANCHORS.md` (filed `osh_docs-count_1` in BACKLOG, correctly out of OSH-4's approved file list), `Artifacts/history/Reports/Phase-OSA-Report.md` (historical), and `Artifacts/anthropic_skills_analysis.md` (unrelated — Anthropic's own skill repo, not this OS) | FIXED |

**Deploy verification:** `Artifacts/Temp/osh-4_deploy.txt` read in full — all 6 steps report success
(`[1/6]` source validation, `[2/6]` test suite — no test files, correctly skipped, `[3/6]` destination
check, `[4/6]` backup created at `~/.claude.backup-20260707-153104`, `[5/6]` production artifacts
copied, `[6/6]` deployment validation passed) ending in `✓ DEPLOYMENT COMPLETE`.

**Verdict: PASS.** 0 CRITICAL, 0 HIGH, 0 MEDIUM open. G4-06 (LOW) remains filed as informational/
non-blocking, consistent with the original gate's disposition. Deploy evidence fresh and complete.

**Not evaluated (still out of this gate's scope):** commit, merge to `main` — withheld pending the
user's explicit `approved, proceed with commit` per `high-rigor-engineering.md` §6.

**OSH-4: PASS — signed off, deployed.**
