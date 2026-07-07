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

---

## OSH-5 Content Gate — Token-Economy Diet & Precedence

**Scope**: Zero-behavioral-loss consolidation of always-loaded rule/CLAUDE corpus (1,827 → 1,160
lines claimed). Branch `phase-osh-5-token-diet`. Evidence read: `Artifacts/Temp/osh-5_linecounts.txt`,
`Artifacts/Temp/osh-5_zeroloss.txt`, `Artifacts/Plans/OSH-5-Plan.md`/`OSH-5-TODO.md`, live `git diff`
against `HEAD` for every touched file (`standards.md`, `orchestration.md`, `model-routing.md`,
`TOKEN-ECONOMICS.md`, `CLAUDE-global.md`, `high-rigor-engineering.md` rename), plus direct reads of
`skills/high-rigor-engineering/{SKILL.md,abstract.md}`, `skills/skills.overview.md`,
`scripts/README.md`, `CLAUDE.md` (repo), and every `commands/*.md` referenced by a dropped
"Context Boundary" cell.

### VERDICT: **PASS** (remediated — see §8 for the fix-and-reverify record)

### 1. Line count (informational — not dispositive, see verdict)

| File | Before | After |
|:---|---:|---:|
| CLAUDE-global.md | 203 | 149 |
| model-routing.md | 272 | 64 |
| orchestration.md | 340 | 300 |
| standards.md | 140 | 127 |
| TOKEN-ECONOMICS.md | 63 | 60 |
| others (unchanged) | 5 files | 5 files |
| **Total** | **1,827** | **1,160** |

Target ≤~1,300 met (−36.5%). This metric is satisfied but is subordinate to the zero-loss hard rule
below — a smaller corpus that silently drops a rule is a regression, not an improvement.

### 2. `/claude-md` scoring (claude-md-standards.md §4)

**CLAUDE-global.md (149 lines)** — verified against actual file content, not the coder's claim:

| Dim | Score | Evidence |
|:---|:---:|:---|
| D1 Size discipline | 2 | 149 lines, well under 250 target / 400 hard cap |
| D2 No rule duplication | 2 | Mirroring Rule, Persistence, Project-Type Routing, Learnings all converted to pointers; Commands table is the *canonical* registry (per OSH-5 binding table), not a duplicate |
| D3 Correct split | 2 | Only global-tier content (agent fleet, command registry, precedence, hooks) |
| D4 Routing currency | 2 | All 8 agents verified present (`agents/*.md`); all 22 slash commands verified present (`commands/*.md`, exact 1:1 count); all referenced skills verified present except `skill-creator`, which `skills.overview.md:21` explicitly documents as plugin-provided (not a stale reference — pre-existing OSH-4 resolution, not introduced here) |
| D5 Actionability | 2 | Tables/bullets throughout, no narration found |
| D6 Precedence clarity | 2 | New `## Precedence` section states rules/common wins over this file, project CLAUDE.md wins over global, named owner file wins per rule domain |

**CLAUDE-global.md: 12/12, no zeros.** Exceeds the ≥10/12 gate.

**CLAUDE.md (repo, 65 lines, unchanged by this phase)**:

| Dim | Score | Evidence |
|:---|:---:|:---|
| D1 | 2 | 65 lines vs ≤150 target |
| D2 | 2 | Only references rules/common, no restatement |
| D3 | 2 | Only repo-specific deploy/layout guidance |
| D4 | 2 | Verified every named file exists: `DEPLOY.md`, `cheatsheet.md`, `GEMINI.md`, `scripts/deploy.sh`, `scripts/model_router.py`, `scripts/model_routing_audit.py`, `scripts/skill_graph_analyzer.py`, `templates/CLAUDE.md.template`, `Artifacts/GLOBAL_INBOX.md` — all present |
| D5 | 2 | Actionable throughout |
| D6 | 2 | States "Global vs repo split... never mix" |

**CLAUDE.md (repo): 12/12** — stays at prior score, confirmed.

### 3. Zero-loss check — 19 claimed blocks (CRITICAL gate)

Verified by direct `git diff HEAD` on every touched file plus `Grep`/`Read` at each claimed canonical
home — the map in `osh-5_zeroloss.txt` was **not** trusted at face value.

| # | Block | Claimed home | Verified? |
|:---|:---|:---|:---|
| 1 | standards.md duplicate Mirroring Rule | standards.md (deduped) | ✅ confirmed via diff |
| 2 | standards.md Location Boundary/Code Blocks bullets | standards.md Artifact Protocol | ✅ confirmed present |
| 3 | standards.md Ruthless Communication (No Fluff/Opinionated/Token Economy) | standards.md Behavioral Personality + Token Economy (pre-existing) | ✅ confirmed all 3 concepts pre-exist |
| 4 | standards.md Briefing/Reporting format | standards.md "Agent Handoff Format" | ✅ confirmed retained verbatim |
| 5 | standards.md Status Vocabulary table (5 rows) | orchestration.md Standard Taxonomies §1 | ✅ confirmed — `FAIL`, `DRIFT`, `STALE`, `GO`, `NO-GO` rows added (diff shows exact insertion) |
| 6 | orchestration.md Model Routing detail (tier table, bindings, cost, YAML, lookup) | model-routing.md + scripts/README.md | ✅ confirmed 1:1 in model-routing.md; cost/decision-tree/YAML/monitoring-template/dated-anecdote all verified present verbatim in scripts/README.md |
| 7 | orchestration.md Command Fleet table (22 rows × Context Boundary) | CLAUDE-global.md Commands table + each command's own file | ✅ 20 of 20 confirmed — 1 was initially lost, remediated at `CLAUDE-global.md:81`; see §4 and §8 |
| 8 | orchestration.md High-Rigor summary bullets | skills/high-rigor-engineering/SKILL.md (full) | ✅ confirmed byte-identical body via direct `diff` (see §5) |
| 9 | orchestration.md scribe write-grant narrowing | orchestration.md Fleet table (corrected, not a loss — a fix) | ✅ confirmed narrowed to match Persistence ownership table |
| 10 | CLAUDE-global.md Project Type Routing table + docx/xlsx footnote | orchestration.md §Project Type Routing | ✅ confirmed footnote added at orchestration.md:48 |
| 11 | CLAUDE-global.md Persistence section + Interface-First/ROI Escalation callouts | orchestration.md §Persistence | ✅ confirmed both callouts present verbatim at orchestration.md:159-163 |
| 12 | CLAUDE-global.md Mirroring Rule section | standards.md Artifact Protocol | ✅ confirmed byte-equivalent rule present |
| 13 | CLAUDE-global.md Persistent Learnings (lifecycle + exclusions) | agents/concierge.md + orchestration.md Persistence row | ✅ confirmed learnings row carries exclusion note (line 179) |
| 14 | model-routing.md Cost Impact/Decision Tree/YAML/Monitoring/anecdote | scripts/README.md §Model-Routing Reference | ✅ confirmed all 6 items present verbatim or near-verbatim |
| 15 | model-routing.md per-agent `effort`/`reasoning_depth` YAML | agents/*.md frontmatter | ✅ confirmed 1:1 match for all 8 agents (direct read) |
| 16 | model-routing.md `use_for:` bullets | agents/*.md `description:` frontmatter | ✅ spot-checked, consistent |
| 17 | TOKEN-ECONOMICS.md Bootstrap Costs (Standard/Deep/Legacy) | Standard retained; Deep/Legacy deleted | ✅ confirmed zero dangling references via repo-wide grep for "25,000 tokens", "50,000+ tokens", "Deep Load", "Legacy Load" |
| 18 | high-rigor-engineering.md whole file | skills/high-rigor-engineering/SKILL.md | ✅ confirmed via direct `diff`: identical body, only frontmatter/precedence-header added and footer/path-prefix changed (see §5) |
| 19 | (registry rows) high-rigor skill registration | skills.overview.md, CLAUDE-global.md Commands table | ✅ confirmed both present |

**19 of 19 blocks fully confirmed.** Block #7 initially had one lost fact (see §4); remediated and
re-verified at §8.

### 4. Context Boundary cell spot-check (all ~20 rows checked individually)

Every dropped "Context Boundary" cell from the deleted `orchestration.md` Command Fleet table was
checked against (a) the command's own `commands/*.md` file, (b) `CLAUDE-global.md`'s Purpose column,
and (c) `orchestration.md`'s Persistence table / other sections.

| Command | Dropped cell | Survives where | Status |
|:---|:---|:---|:---|
| `/blueprint` | Writes to IMPLEMENTATION_PLAN.md | `commands/blueprint.md` (Mode Detection references it directly) | OK |
| `/audit` | Writes to AUDIT_REPORT.md | `commands/audit.md:24` "**CRITICAL:** ... save ... into `Artifacts/AUDIT_REPORT.md`"; also new orchestration.md Persistence row | OK |
| `/sync` | Validates Artifacts/ vs source | `commands/sync.md` full Execution Sequence (Inventory Delta, State File Validation) | OK |
| `/ingest` | Formalizes `Artifacts/LAYOUT_SPEC.md` | Initially **NOWHERE** (see below); remediated at `CLAUDE-global.md:81` — see §8 | **FIXED** |
| `/handoff` | Writes HANDOFF_BRIEF.md; archives to History/ | `commands/handoff.md:50` (writes HANDOFF_BRIEF.md), `:49,:55` (archives to History/) | OK |
| `/registry-audit` | Validates links/enums | `commands/registry-audit.md` full checklist (Skill/Command Integrity, PROJECT_TYPE Sync) | OK |
| `/council` | Follows COUNCIL_PROTOCOLS.md | `commands/council.md:16` "Reference `Artifacts/COUNCIL_PROTOCOLS.md`" | OK |
| `/grill` | Active interview mode | `commands/grill.md` "Grill Brief (User Interview)" section | OK |
| `/sweep` | Registry-wide discovery | `commands/sweep.md` full workflow (Phase 0 Registry Integrity, multi-phase scan) | OK |
| `/snapshot` | Purely descriptive | `commands/snapshot.md:12` "without analysis or prose padding" | OK |
| `/clean` | Maintenance mode | `commands/clean.md` full execution sequence | OK |
| `/learn` | Writes to Artifacts/learnings/ | `commands/learn.md` full procedure | OK |
| `/graduate` | Writes to Global Registry | `commands/graduate.md` Purpose line | OK |
| `/skill-graph` | Generates routing recommendations | `commands/skill-graph.md` description + step 5 | OK |
| `/docs` | Writes README/ARCH.md/tiered docs | `commands/docs.md` Modes section | OK |
| `/explain` | Read-only | `commands/explain.md` frontmatter `allowed-tools: Read, Grep, Glob` | OK |
| `/triage` | Investigation only, no source edits until plan approved | `commands/triage.md:15` Objective + folded into `CLAUDE-global.md:86` Purpose column verbatim | OK |
| `/ideate` | Writes VIDEO_PLAN.md | `commands/ideate.md:26,36` | OK |
| `/deck` | Scaffolds project / writes deck files per action | `commands/deck.md` Actions section | OK |
| `/claude-md` | Report-first; edits only on confirmation | `commands/claude-md.md:2` frontmatter description, verbatim | OK |
| `/script` | Writes SCRIPT.md | `commands/script.md:20` | OK |
| `/pack` | Generates metadata; no SCRIPT/VIDEO_PLAN edits | Folded into `CLAUDE-global.md:78` Purpose column verbatim | OK |

**20 of 20 confirmed** (as of remediation — see §8). Initially 19/20: `/ingest`'s LAYOUT_SPEC.md-
formalization constraint had no surviving home anywhere in the corpus. This was exactly the failure
mode Hard Rule #1 exists to catch — the zero-loss map itself flagged this table as its "lowest-
confidence item" and asked for auditor spot-check; the spot-check found a real loss, not a false
alarm.

**Why it mattered (not pedantry)**: without this line, nothing in the corpus told an agent that
manual `LAYOUT_SPEC.md` edits (e.g., a user hand-tweaks a PowerPoint/Rhino layout outside the AI
session) should be routed through `/ingest` to formalize them. `commands/ingest.md`'s own "Source
Detection" list (geometry export, DAX/SQL, script handoff, config/data) does not include layout/design
artifacts — so the connection between `/ingest` and creative-director's `LAYOUT_SPEC.md` was not
merely under-detailed, it was entirely absent post-edit. Now fixed — see §8.

### 5. Precedence statements (RU-P2..P5)

| # | Statement | Location | Verified |
|:---|:---|:---|:---|
| 1 | `rules/common/*` wins over CLAUDE-global.md; project CLAUDE.md wins over global; named owner file wins per rule domain | `CLAUDE-global.md` §Precedence (new) | ✅ present, unambiguous |
| 2 | `model-routing.md` is canonical for routing; "on divergence it wins" | `orchestration.md` §Model Routing | ✅ present verbatim |
| 3 | High-rigor skill overrides orchestration.md on commit cadence/approval phrases; defers otherwise | `skills/high-rigor-engineering/SKILL.md` header blockquote | ✅ present verbatim |

All 3 precedence statements confirmed present and state clear winners — no silent-precedence gap.

### 6. High-rigor demotion (rules/common/ → skill)

- ✅ `git status` shows a genuine rename (`R rules/common/high-rigor-engineering.md ->
  skills/high-rigor-engineering/SKILL.md`), confirmed via direct `diff` against `git show
  HEAD:rules/common/high-rigor-engineering.md` — **body is byte-identical** across all 11 numbered
  sections; only diff is (a) frontmatter block added, (b) `**Owners**` line + precedence blockquote
  added, (c) 3 cross-reference paths re-qualified to `rules/common/...`, (d) trailing "Last
  updated/Applies to/Superseded by" changelog footer removed (non-behavioral doc-history metadata).
- ✅ Valid frontmatter: `name`, `description` (states when-to-use / when-NOT-to-use), `model:
  claude-sonnet-5`, `metadata.version`, `metadata.tags`.
- ✅ L0 abstract exists at `skills/high-rigor-engineering/abstract.md` — correctly triggered since the
  skill body (360 lines) exceeds the 150-line L0 threshold (TOKEN-ECONOMICS.md).
- ✅ Registered in `skills/skills.overview.md:12` and `CLAUDE-global.md:75` Commands table.
- ✅ Confirmed absent from `rules/common/` (directory listing shows 9 files, high-rigor-engineering.md
  not among them).
- ✅ `scripts/deploy.sh` has no residual reference to the old path (`grep` for "high-rigor" returned
  no matches in deploy.sh).

**High-rigor demotion: fully verified, no issues.**

### 7. Summary (pre-remediation state, kept for record)

**CRITICAL (blocked PASS at first pass)**:
- Restore the `/ingest` ↔ `Artifacts/LAYOUT_SPEC.md` formalization behavior. Minimum fix: add one
  line to `commands/ingest.md` (e.g., under "When to Use" or "Source Detection") naming
  `Artifacts/LAYOUT_SPEC.md` as an ingestible artifact when creative-director's manual layout work is
  imported, OR add it back to `CLAUDE-global.md`'s `/ingest` Purpose column (matching the `/triage` and
  `/pack` precedent already used in this same phase for folding in unique facts before deleting the
  source table).

**Not blocking, no action required**: line-count metric, both `/claude-md` scores, precedence
statements, high-rigor demotion, and 18/19 other zero-loss blocks were all clean at first pass.

### 8. Remediation & re-verification (closes the gate)

**Fix applied**: `CLAUDE-global.md:81` changed from

```
| `/ingest` | concierge | Register manual/external changes into project state |
```

to

```
| `/ingest` | concierge | Register manual/external changes into project state — formalizes `Artifacts/LAYOUT_SPEC.md` |
```

**Re-verification (scoped to this one cell only, per instruction — no other file changed, so no
re-scan of the other 18 zero-loss blocks or the 19 other Context Boundary cells was needed)**:

- Read `CLAUDE-global.md:78-87` directly (not trusted from the coordinator's message) — confirmed
  line 81 reads exactly as claimed above.
- Pattern match confirmed identical in structure to the two precedents already verified OK in §4:
  `/triage` (line 86: "— investigation only, no source edits until plan approved") and `/pack`
  (line 78: "— no edits to `SCRIPT.md`/`VIDEO_PLAN.md`") — both are "Purpose column, em-dash-appended
  constraint" folds, same mechanism now used for `/ingest`.
- The `/ingest` ↔ `Artifacts/LAYOUT_SPEC.md` fact now has exactly one canonical home
  (`CLAUDE-global.md:81`), consistent with Hard Rule #2 (pointers/single-home, not scattered copies).

**Result**: Block #7 (Command Fleet table) and its one previously-lost Context Boundary cell are now
both fully confirmed. All 19 zero-loss blocks and all 20 Context Boundary cells are accounted for.
Combined with the already-clean line count, both `/claude-md` scores, all 3 precedence statements, and
the high-rigor demotion (§§1-2, 5-6), every gate task now passes.

---

## OSH-6 Pre-Deploy Gate — Tooling & Repo Hygiene

**Branch:** `phase-osh-6-tooling-hygiene` · **Reviewed:** uncommitted working tree (staged/unstaged) against `Artifacts/Plans/OSH-6-Plan.md` · **Method:** every claim independently re-derived — real `git diff`, sandboxed `deploy.sh` runs (`HOME=` redirected, never touched real `~/.claude/`), and two isolated mutation tests against scratch copies (never the tracked files).

### Verdict: **PASS** (updated 2026-07-08 — see Re-Verification below; originally PASS-WITH-CONDITIONS)

Original gate found one genuine defect (a hollow regression test) plus one real rollback-safety gap in `deploy.sh`. Both conditions have since been remediated and independently re-verified by this auditor (mutation-tested and sandbox-simulated, not taken on the coder's word) — see "### Re-Verification (2026-07-08)" at the end of this section. Condition 3 (running an actual `bash scripts/deploy.sh` against real `~/.claude/`) remains outstanding but is gated on explicit user approval, not on further auditor action.

### Project Profile
Language: Bash, Python 3.14 (host), Markdown. Domain: dev-tooling / repo hygiene for an AI-agent-OS source repo (not a runtime application). No Rhino/GH/DAX surface. Test/lint: `pytest`, manual CLI smoke.

### Strengths

- **`model_router.py` plugin lookup is a real fix, not a hack.** `find_skill_file()` genuinely globs `optional_plugins/*/skills/<name>/SKILL.md` and falls back cleanly; verified live: `python scripts/model_router.py --lookup skill manuscript-review scribe` → `sonnet` (matches plan's acceptance test exactly, fresh run, not code-inspection).
- **`skill_graph_analyzer.py` plugin scan is symmetric and correct.** `load_plugin_skills()` finds all 16 `optional_plugins/*/skills/*/SKILL.md` files; `python scripts/skill_graph_analyzer.py .` reports "Total Skills: 31" = 15 repo + 16 plugin, exit 0. Dead `isinstance` guards and unused `TypedDict`/`json` imports genuinely removed (confirmed via diff, not claimed).
- **`deploy.sh` backup/copy symmetry is correct.** `DEPLOYED_ITEMS` (backup) and the copy-loop + explicit file copies (deploy) target the identical 9 items (`agents rules skills templates commands hooks CLAUDE.md cheatsheet.md README.md`). Verified via a full sandboxed deploy run: backup 585 KB (well under the 10 MB metric), `optional_plugins` absent from `~/.claude/`, validation step green.
- **Backup pruning works.** Sandboxed test with 7 pre-existing backups + 1 new → correctly pruned to 5.
- **`--force` cleanly removed**, not left as a dead flag: parser rejects it (exit 1, "Unknown flag"), and a repo-wide grep confirms zero remaining doc references to a `deploy.sh --force` flag (CLAUDE.md, DEPLOY.md, cheatsheet.md all updated together).
- **Docs are honest, not just reworded.** Every command added to `cheatsheet.md`'s intent table (`/deck`, `/snapshot`, `/ideate`, `/script`, `/pack`, `/registry-audit`, `/clean`, `/graduate`, `/learn`) has a real matching file in `commands/`. `glossary-extraction` correctly re-labeled "(skill, no slash)" — verified it lives at `skills/glossary-extraction/`, not `commands/`. Dead `scripts/migrate_skills_to_plugins.py` / `scripts/phase_11_*.py` references removed from `DEPLOY.md` — confirmed those files no longer exist anywhere in the repo.
- **NEXT_SESSION content check was real, not skipped.** The archived `NEXT_SESSION_plugin-registry-gap.md` finding is genuinely resolved — cross-checked against `Artifacts/DECISION_LOG.md:75` ("2026-07-06 — Convert optional_plugins to native Claude Code plugins"), which pre-dates this phase and was correctly left untouched.
- **30/30 tests pass, exit 0** (plan required ≥8). Three of four suites are demonstrably regression-locked (see Hard Rule 2 below) with well-designed edge cases (malformed frontmatter, vacuous-pass guards in `test_registry_integrity.py`).
- **Scope discipline held**: no `agents/*.md`, `skills/*/SKILL.md`, `rules/common/*`, or `commands/*.md` content touched — tooling/docs/tests/hygiene only, per Hard Rule 3.

### Hard Rule 1 — Moves, not deletes: **PASS**

- All 14 archive moves are real `git mv`-tracked renames (`R` status, 100% similarity, zero content diff) into `Artifacts/History/` (+ `History/Plans/` for `CMD-Plan.md`). Verified via `git status --short` and `git diff --stat`.
- `Artifacts/task.md` (deleted, 18 lines): content is a checklist of already-`[x]`-marked phases (PR-A/B/C, Phase 11, Phase 12). Cross-checked against `git log --all --oneline` — the actual work is committed (`cea263f feat: implement tiered handoff and scratch redirection`, `243e96a feat: upgrade planning rigor...`). Nothing unique lost; genuinely superseded by `.agent/current_task.md`. **Safe.**
- `Artifacts/Temp/scratch_test.md` (deleted, 2 lines): a one-off scratch-location verification note, already `D`-flagged on disk pre-phase per `current_task.md`'s own open-threads list. **Safe.**
- `Artifacts/SESSIONS/` (claimed deleted): directory does not exist on disk and produces no git diff (git doesn't track empty dirs) — consistent with "was already empty." **Safe, nothing to lose.**

### Hard Rule 2 — Regression-lock: **CONDITIONAL FAIL (1 of 30 tests)**

Ran `pytest tests/ -v` myself (not trusted from coder summary): **30 passed, exit 0.** Fresh, clean run confirmed twice after an unrelated environment hiccup (see note below).

Mutation-tested every test the coder didn't already prove, using throwaway copies (never editing the tracked files):

| Test file | Mutation applied | Result |
|:---|:---|:---|
| `test_hooks_smoke.py::test_guard_commands_denies_rm_rf_root` | Commented out the `rm -rf /` root-delete pattern in a scratch copy of `guard-commands.js` | **Test correctly FAILED** (JSON decode error on now-empty/allowed output) — genuinely regression-locked. |
| `test_routing_audit_parsing.py::test_load_assigned_models_skips_overview_and_abstract_files` | Removed the `.abstract.md`/`agents.overview.md` skip branch in a scratch copy of `model_routing_audit.py` | **Test correctly FAILED** — genuinely regression-locked. |
| `test_routing_audit_parsing.py::test_dominant_model_reads_transcript_and_ignores_synthetic` | Removed the `!= SYNTHETIC` filter (i.e., synthetic entries now counted) in a scratch copy | **Test still PASSED.** **HOLLOW TEST — does not lock its claimed regression.** |

**Root cause of the hollow test**: the fixture has 2× `claude-sonnet-5` vs 1× `<synthetic>`. Sonnet wins `most_common(1)` regardless of whether synthetic is filtered — the assertion (`== "claude-sonnet-5"`) passes identically with the fix reverted. The test's own docstring/name promises "ignores synthetic" but the data never forces that code path to matter. **Fix required**: rebalance the fixture so removing the filter changes the outcome (e.g., 1× real model vs 2× `<synthetic>`, asserting the real model still wins) before this can count as a locked regression test.

**Process note (self-disclosed)**: during mutation testing I ran `git checkout -- scripts/model_routing_audit.py` intending to restore my own scratch edit, but the coder's changes to that file were unstaged (not staged), so the checkout reverted the file to HEAD, wiping the coder's diff. Caught immediately via `git diff HEAD` returning empty, restored from a pre-mutation backup I'd taken, and reconfirmed the restored file byte-for-byte matches the diff captured at the start of this audit. Final working tree matches the original `git status --short` exactly (verified side-by-side above). Flagging per this agent's own evidence-first standard — the coder's work was not lost, but the near-miss is recorded.

### Hard Rule 3 — No OS-behavior change: **PASS**

- `sys.stdout` reassignment moved behind `if __name__ == "__main__":` in all 3 scripts (`model_router.py`, `model_routing_audit.py`, `skill_graph_analyzer.py`). Verified CLI behavior is unchanged: ran all three directly — `--table`, `--lookup`, `--violations-only`, and `skill_graph_analyzer.py .` all produced correct output including UTF-8 special characters (★ markers render correctly), confirming the wrapper still applies at runtime, only import-time reassignment (which was corrupting pytest's capture fixture) is removed.
- No `agents/*.md`, `skills/*/SKILL.md`, `rules/common/*.md`, or `commands/*.md` files appear in the diff — confirmed via `git status --short` (only `scripts/`, `tests/`, `templates/`, `CLAUDE.md`, `DEPLOY.md`, `cheatsheet.md`, `Artifacts/` changed).
- `deploy.sh` itself changes deploy *mechanics* (in-scope, plan-authorized) but not deployed *content* — the set of files it copies is unchanged in kind (still `agents rules skills templates commands hooks` + 3 docs), only `optional_plugins` is dropped (per plan, since real installs live in `~/.claude/plugins/`).

### deploy.sh Safety Assessment (highest-risk change)

Ran `bash scripts/deploy.sh` end-to-end against a fully sandboxed `HOME=` (never touched the real `~/.claude/`), including a repeat run with 7 pre-seeded fake backups to test pruning. Findings:

- **Forward path is solid**: validate → test-gate → backup (scoped, 585 KB) → copy (clean `rm -rf` + `cp -r`, no nesting) → validate. Exit 0, all 6 steps green.
- **Backup/copy scope is symmetric** (9 items each side) — the concern flagged in the task brief is resolved correctly.
- **Rollback hint has a real, reproducible gap.** The printed rollback command (`cp -r "$BACKUP_DIR/." "$DEST/"`) is a *merge*-copy, not the old *replace* semantics (`rm -rf ~/.claude && cp -r backup ~/.claude`). Reproduced directly: added a file to a deployed dir that postdates a given backup, then ran the documented rollback command — **the new file survived the rollback** (merge-copy never deletes extras). This means if a future deploy *adds* a new rule/skill/command file and that deploy needs to be rolled back, the stray new file is left behind in production. Low likelihood of triggering during a single-phase rollback, but real, and the plan explicitly cared about backup/rollback correctness (TL-M3/M4). **Recommend**: prefix the rollback hint with a clean of each deployed item (`rm -rf "$DEST/$item"` for each in `DEPLOYED_ITEMS`) before the merge-copy, restoring the old replace-semantics without reintroducing the original "wipes all of `~/.claude/`" over-broad-delete problem.
- **No `Artifacts/Temp/osh-6_verify.txt` evidence exists**, and the corresponding TODO line ("Full deploy + verification commands... → osh-6_verify.txt") is still `[ ]`, not `[-]`. The coder did not self-verify `deploy.sh` end-to-end before handoff — I generated the above evidence myself as the auditor since none existed. This should not have been left for the auditor to discover from scratch; flag for strategist re: coder's exit-criteria discipline on this task line.

### Scope Deviation Rulings

**(a) Coder edited `Artifacts/TODO.md` pointer references — ACCEPTABLE, narrow.** Two lines changed: the `CMD-Plan.md` path pointer (now `History/Plans/CMD-Plan.md`) and the `NEXT_SESSION_plugin-registry-gap.md` note (now points at the archived location + resolved-decision reference). Both are mechanical, direct consequences of the coder's own authorized archive-sweep action in the same diff — leaving them stale would have been worse than fixing them. This is not "add/remove tasks" (forbidden) or a status-marker change (auditor-only) — it's incidental path-text hygiene. Ruling: accept, but strategist should ratify at next plan touch since `Artifacts/TODO.md` restructuring is nominally strategist-owned per the TODO authority table.

**(b) Test suite is 284 lines vs. the plan's "<200 lines" guideline — ACCEPTABLE.** The 200-line figure is in "Technical Approach" (soft guidance), not a Hard Rule. Read all 4 files: no padding, no redundant fixtures — each file targets a genuinely distinct regression class (router lookup, audit-parsing, hook subprocess contract, registry cross-reference), and `test_registry_integrity.py`'s vacuous-pass guard is exactly the kind of defensive test that justifies going over a soft line budget. Net: acceptable overrun.

### Strategist Findings Confirmed (not auditor's to fix)

- `Artifacts/IMPLEMENTATION_PLAN.md` (around the "Verify-only / DO NOT EDIT" list) references `scripts/phase_11_2_update_templates.py` and `scripts/migrate_skills_to_plugins.py` — **confirmed these files no longer exist anywhere in the repo** — and references `Artifacts/PHASE_11_*`, `Artifacts/SKILL_*`, `REGISTRY_HEALTH_REPORT.md` at their old root paths — **confirmed these are now moved to `Artifacts/History/`.** Both are real stale pointers.
- `Artifacts/MEMORY_ANCHORS.md`'s "Skill Audit History" table links `Artifacts/SKILL_AUDIT_REPORT.md` — **confirmed moved to `Artifacts/History/SKILL_AUDIT_REPORT.md`,** link is stale.
- Confirmed via `git status`/`git diff` that the coder correctly left both files untouched (strategist-owned) rather than editing them itself.

### Conditions Before Deploy Sign-Off

1. **Fix the hollow test** — rebalance `test_dominant_model_reads_transcript_and_ignores_synthetic`'s fixture (or add a second assertion case) so it fails when the `!= SYNTHETIC` filter is removed. Re-run the mutation check to confirm.
2. **Fix the rollback-hint gap in `deploy.sh`/`DEPLOY.md`** — clean each deployed item before the merge-copy in the documented rollback command, or explicitly document the merge-copy's limitation (added files aren't removed) if the coder/strategist judge the fix not worth the complexity. Either resolution is acceptable; silence is not.
3. **Run the actual `bash scripts/deploy.sh` full verification** the phase plan calls for and capture it to `Artifacts/Temp/osh-6_verify.txt` — this task line is still `[ ]`, unverified by the coder. (I ran a sandboxed equivalent above as gate evidence, but the phase's own exit criterion asks for this artifact and it doesn't exist yet.)
4. Strategist should ratify the `Artifacts/TODO.md` pointer-text edits (scope deviation a) and the 2 confirmed stale pointers in `IMPLEMENTATION_PLAN.md`/`MEMORY_ANCHORS.md` at next touch — not blocking, but should not be silently forgotten.

None of the above are regressions in already-shipped OS behavior (Hard Rule 3 holds), and the `~/.claude/optional_plugins/` deletion + full deploy remain safe to proceed **once conditions 1–3 are closed**. Re-audit after fixes; do not mark the phase's remaining TODO lines `[x]` until then.

---

### Re-Verification (2026-07-08) — Conditions 1 & 2

Re-verified only the 2 code conditions per coordinator request. Condition 4 (strategist stale pointers) was reported already fixed by the coordinator — confirmed via `git status --short` that `Artifacts/IMPLEMENTATION_PLAN.md` and `Artifacts/MEMORY_ANCHORS.md` now show as modified (strategist-owned edits present) — not independently re-read line-by-line per the coordinator's instruction to skip re-checking it. Nothing was trusted from the coder's remediation claim; both conditions were mutation-tested / simulated directly.

**Condition 1 (hollow test) — CLEARED.**

`tests/test_routing_audit_parsing.py::test_dominant_model_reads_transcript_and_ignores_synthetic` fixture is now 1× `claude-sonnet-5` : 3× `<synthetic>` (was 2:1). Re-ran the exact mutation protocol from the original gate, in an isolated scratch copy (tracked files never touched):

| Step | Action | Result |
|:---|:---|:---|
| 1 | Baseline (unmutated) run | PASSED |
| 2 | Removed the `!= SYNTHETIC` filter in the scratch copy | **FAILED** — `AssertionError: assert '<synthetic>' == 'claude-sonnet-5'` (synthetic now wins 3-to-1, exactly the intended flip) |
| 3 | Restored unmutated file, re-ran | PASSED |

The test now genuinely locks the regression it claims to guard. Full suite re-run on the real tree: `pytest tests/ -v` → **30 passed, exit 0.**

**Condition 2 (rollback) — CLEARED.**

Verified both bugs and both fixes, sandboxed under a scratch `HOME=` (real `~/.claude/` never touched):

- Ran a fresh sandboxed deploy, then seeded non-deployed production data that must never be touched by rollback: `plugins/some-plugin/data.json`, `projects/my-project/session.jsonl`, `settings.json`.
- Ran a second deploy (this backup is the rollback target), then simulated a **third**, later deploy adding a new file to a deployed dir (`rules/STRAY_NEW_RULE.md`) that postdates the rollback-target backup — reproducing exactly the scenario the original gate flagged.
- Executed the exact per-item loop `scripts/deploy.sh:189-191` prints (copy-pasted the live rendered output, not a paraphrase: `for item in agents rules skills templates commands hooks CLAUDE.md cheatsheet.md README.md; do rm -rf "$DEST/$item"; [ -e "$BACKUP_DIR/$item" ] && cp -r "$BACKUP_DIR/$item" "$DEST/$item"; done`).
- **Result**: `STRAY_NEW_RULE.md` was removed (real replace-semantics — the merge-copy bug from the original gate is fixed). `rules/` file count restored to the pre-stray baseline (9 files). The three non-deployed files (`plugins/`, `projects/`, `settings.json`) were **byte-identical (md5) before and after** — confirming the coder's second bug-fix (the opposite failure mode: a full `rm -rf ~/.claude && cp -r backup ~/.claude` would have destroyed all three) is also real and correctly resolved by the new per-item loop.
- `DEPLOY.md`'s Rollback Procedure section was diffed against `scripts/deploy.sh:189-191` — the documented `for item in agents rules skills templates commands hooks CLAUDE.md cheatsheet.md README.md; do rm -rf ~/.claude/$item; [ -e "$BACKUP/$item" ] && cp -r "$BACKUP/$item" ~/.claude/$item; done` snippet matches the script's `DEPLOYED_ITEMS` list and logic exactly (same 9 items, same order, same remove-then-conditional-copy semantics). Docs and code agree.

**Gate status**: Both code conditions cleared with fresh, self-generated evidence (not claims). Condition 3 (an actual `bash scripts/deploy.sh` run against real `~/.claude/`, plus `Artifacts/Temp/osh-6_verify.txt`) and the `[user-approval]` deletion of `~/.claude/optional_plugins/` remain outstanding — both require the user's explicit go-ahead per the phase plan, not further auditor verification. Do not mark the phase's remaining `Artifacts/Plans/OSH-6-TODO.md` lines `[x]` until the real deploy runs and its evidence is captured.

**Gate re-audit trigger consumed**: no further re-audit needed for OSH-5 content.

---

## OSH-6 Final Sign-Off (terminal phase — closes Initiative OSH)

**Date:** 2026-07-08 · **Branch:** `phase-osh-6-tooling-hygiene` · **Method:** fresh evidence only — nothing accepted on the coordinator's or coder's word.

### VERDICT: **PASS — initiative-complete.** All 6 OSH phases now auditor-PASSed; OSH-6 deployed; commit/merge is the only remaining step, gated on explicit user approval (not auditor action).

### 1. Deploy evidence (`Artifacts/Temp/osh-6_verify.txt`)

Read in full. Confirms, fresh: `[1/6]` source validation ✓, `[2/6]` test suite — **30 collected, 30 passed** (not skipped, actually ran) ✓, `[3/6]` destination ready ✓, `[4/6]` backup created at `~/.claude.backup-20260708-000656` + "Pruned 7 old backup(s), keeping last 5" ✓, `[5/6]` artifacts copied ✓, `[6/6]` validation passed ✓ → `DEPLOYMENT COMPLETE`. Independently re-confirmed live: `ls -d ~/.claude.backup-*` → exactly 5 directories, newest matches the verify.txt timestamp. `~/.claude/optional_plugins/` → `No such file or directory` (confirmed absent). `~/.claude/plugins/` → present with native marketplace/catalog files intact. Evidence is fresh, complete, and matches reality — not summarized or asserted.

### 2. Hard Rules — held across the whole phase

| Rule | Status | Evidence |
|:---|:---|:---|
| **1. Moves-not-deletes** | PASS | `git status --short` (fresh, this pass): all 14 archive entries show as `R` (100%-similarity renames) into `Artifacts/History/` (+ `History/Plans/` for `CMD-Plan.md`). Only 2 real deletions, both pre-enumerated: `Artifacts/task.md` (superseded checklist, work committed elsewhere — confirmed via `git log`), `Artifacts/Temp/scratch_test.md` (scratch note, `D`-staged for `git rm --cached`). No unenumerated deletion. |
| **2. Regression-lock** | PASS | Re-ran `pytest tests/ -v` fresh this pass: **30 passed, exit 0** (plan required ≥8). The pre-deploy gate's one hollow test (`test_dominant_model_reads_transcript_and_ignores_synthetic`) was remediated and independently mutation-re-verified in this file's "Re-Verification (2026-07-08)" section above (fixture rebalanced 1:3, mutation now correctly fails). Not re-litigated here per the standing re-audit-trigger-consumed note — carried forward as already-cleared. |
| **3. No-OS-behavior-change** | PASS | Fresh `git status --short` this pass: changed paths are `Artifacts/*` (hygiene + strategist pointer fixes), `CLAUDE.md`, `DEPLOY.md`, `cheatsheet.md`, `scripts/*.py`, `scripts/deploy.sh`, `templates/*`, `tests/` (new, untracked). **Zero** `agents/*.md`, `skills/*/SKILL.md`, `rules/common/*`, or `commands/*.md` entries — confirmed by direct grep of the status output, not inference. `git diff --stat main HEAD` returns empty because `main` and this branch's tip are the same commit (all changes are uncommitted working-tree edits, consistent with "not yet committed" status) — the correct check is therefore the working-tree diff against tracked HEAD, which is what was inspected. |

### 3. Success metrics — plan checklist walked against reality

| Metric (OSH-6-Plan.md §Success Metrics / §Verification) | Result | Fresh evidence |
|:---|:---|:---|
| Router regression test green; manuscript-review → sonnet | ✅ | `python scripts/model_router.py --lookup skill manuscript-review scribe` → `{"tier": "sonnet", "model": "claude-sonnet-5", ...}` (this pass, live run) |
| `pytest tests/ -v` ≥ 8 tests, exit 0 | ✅ | 30 passed, exit 0 (this pass) |
| `bash scripts/deploy.sh` full run: validation passes, `optional_plugins/` absent, backup <10 MB, ≤5 retained | ✅ | `osh-6_verify.txt` all-green + live filesystem check: `~/.claude/optional_plugins` absent, exactly 5 backup dirs present (pruned from a pre-existing 7, matching the "Pruned 7... keeping last 5" log line). `du -sh` on the 5 surviving dirs: the phase's own new backup (`.claude.backup-20260708-000656`, scoped by the fixed deploy.sh) is **584 KB** — well under 10 MB. The 4 older surviving backups (115–150 MB each) predate this phase's `DEPLOYED_ITEMS`-scoping fix (TL-M4) and were correctly left as-is (the fix scopes new backups going forward; it does not retroactively shrink legacy ones) — not a violation of the metric, which concerns this phase's own deploy output. |
| deploy.sh ↔ DEPLOY.md ↔ CLAUDE.md fully agree | ✅ | Spot-audited this pass: `optional_plugins` exclusion comment present in all 3 (deploy.sh:132, DEPLOY.md:40/131, CLAUDE.md:33); `DEPLOYED_ITEMS` list (`agents rules skills templates commands hooks CLAUDE.md cheatsheet.md README.md`) identical in deploy.sh (:100, :191) and DEPLOY.md (:28, :107); zero `--force` references remain anywhere in scripts/deploy.sh, DEPLOY.md, CLAUDE.md, or cheatsheet.md (fully removed, not left dangling) |
| `Get-ChildItem Artifacts` root schema-clean | ✅ | Fresh `ls -la Artifacts/`: only schema-recognized entries (`ARCH.md`, `AUDIT_REPORT.md`, `BACKLOG.md`, `COUNCIL_PROTOCOLS.md`, `DECISION_LOG.md`, `GLOBAL_INBOX.md`, `HANDOFF_BRIEF.md`, `IMPLEMENTATION_PLAN.md`, `LOCAL_AGENT_PROFILES.json`, `MEMORY_ANCHORS.md`, `Plans/`, `Reports/`, `TODO.md`, `Temp/`, `History/` (see below), `learnings/`, `.agent/`). None of the 14 archived files, `task.md`, or `SESSIONS/` remain at root. |
| Single `History/` casing holds all archives | ✅ | `git ls-files \| grep -c "^Artifacts/History/"` → 18 (includes the phase's 14 new moves + 4 pre-existing). `git ls-files \| grep -c "^Artifacts/history/"` (literal lowercase path) → **0**. The `ls` listing shows a physical dir named `history` only because NTFS is case-insensitive-but-preserving (Windows quirk, not a git dual-tracking regression) — git's index has exactly one casing tracked. TL-H5/RU-F4 confirmed resolved. |
| Auditor PASS | ✅ | This section. |

### 4. `[user-approval]` task — `~/.claude/optional_plugins/` deletion

Confirmed independently, not taken on report: `ls ~/.claude/optional_plugins` → "No such file or directory". `ls ~/.claude/plugins` → native plugin data intact (`blocklist.json`, `installed_plugins.json`, `known_marketplaces.json`, `marketplaces/`, `plugin-catalog-cache.json`). All 9 `DEPLOYED_ITEMS` present and current-dated at `~/.claude/` (`CLAUDE.md`, `README.md`, `cheatsheet.md`, `agents/`, `commands/`, `hooks/`, `rules` via `Artifacts` sibling paths, `skills/`, `templates/`). One documentation gap noted, non-blocking: `Artifacts/DECISION_LOG.md` has no dedicated entry recording the user's explicit approval of this specific deletion (the closest entry, 2026-07-06, covers the broader plugin-architecture conversion, not this cleanup step) — acceptable given the OSH Step-0 approval already covers all 6 phases' file-level actions, but flagged for the strategist to consider a one-line addendum at next DECISION_LOG touch.

### 5. Tasks marked `[x]` this pass

- `Artifacts/Plans/OSH-6-TODO.md`: all 12 task lines (branch creation through the auditor verification line) + all 4 Status-block checkboxes (Strategist approval [already x], Git branch created, Implementation complete, Auditor verification complete).
- `Artifacts/TODO.md`: OSH-6 initiative line (line 13) → `[x]`, following the OSH-4/OSH-5 convention (audit-PASS + deploy = `[x]` at this tier; commit/merge still pending explicit approval, noted inline).

### 6. Not evaluated (explicitly out of auditor scope)

`git commit`, `git push`, merge to `main` — all withheld pending the user's explicit `approved, proceed with commit` per `high-rigor-engineering.md` §6. This sign-off authorizes commit-readiness; it does not execute or request the commit.

**Initiative OSH (6/6 phases): PASS.**
