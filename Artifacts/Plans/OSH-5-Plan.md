# Phase OSH-5: Token-Economy Diet & Precedence

**Initiative:** OSH — OS Hardening · **Findings:** AUDIT_REPORT.md §4 (RU-D1..D10, RU-T1..T4, RU-P2..P5, RU-S2..S4, RU-F11/F12)
**Branch:** `phase-osh-5-token-diet` · **Owner:** coder → auditor (with `/claude-md` as the exit gate)

## Objectives

Cut the always-loaded corpus from 1,875 lines to ≤ ~1,300 (~30%) with **zero behavioral
loss**: every duplicated block gets one canonical home + pointers; documentation masquerading
as rules moves out of the always-loaded set; every rule-pair that can conflict gets an
explicit precedence statement. Exit gate: CLAUDE-global.md rescored by `/claude-md` at
≥ 10/12 with no zeros.

## Technical Approach

**Canonical-home decisions (binding):**

| Content | Canonical home | Everyone else keeps |
|:---|:---|:---|
| Agent/model routing table + hard rules + fallback | `model-routing.md` (cut to ~40 lines) | orchestration: 1-line pointer + the fleet-role table (roles ≠ routing) |
| Command registry | `CLAUDE-global.md` (completed in OSH-4) | orchestration: Automatic-Routing prose + pointer; Concierge-Ops re-descriptions deleted |
| Project-type routing | `orchestration.md` | CLAUDE-global: 2-line pointer |
| Artifacts persistence layout | `orchestration.md` (table + lifecycle) | CLAUDE-global: 3-line pointer + Root-Files one-liner |
| Mirroring Rule | `standards.md` (once) | CLAUDE-global + orchestration: pointer |
| Learnings lifecycle | `orchestration.md` persistence row + concierge agent | CLAUDE-global: pointer |
| Status vocabulary | `orchestration.md` Standard Taxonomies | standards.md: pointer |
| High-rigor protocol | new on-demand skill | orchestration keeps its 15-line pointer |

**Demotions out of always-loaded:**
- `high-rigor-engineering.md` (349 ln) → `skills/high-rigor-engineering/SKILL.md` (content
  as-is minus footer metadata; description: "Use when a phase declares high-rigor mode —
  geometry validation, production deploys, regulatory work. Do NOT use for prototyping or
  docs."). Delete from `rules/common/` and from deploy's rules set; update orchestration's
  pointer to name the skill. Registry rows via the OSH-4-corrected tables.
- `model-routing.md` → keep ~40-line rule (tier table, agent bindings incl. geometry-validator,
  skill-override table, hard rules, fallback chain, verification pointer). Cost analysis,
  decision tree, YAML pseudo-config, implementation details, cost-monitoring template, dated
  anecdote → `scripts/README.md` §Model-Routing Reference.
- `TOKEN-ECONOMICS.md` → trim bootstrap-cost narration; keep L0/L1/L2 flow, slicing
  thresholds, 60% trigger, (OSH-3-fixed) Findings pointer, (OSH-4-amended) L0 threshold.

**Precedence statements to add:**
1. `CLAUDE-global.md` (new short "Precedence" block): *rules/common/* wins over this file on
   any overlap (this file is routing + pointers); a project CLAUDE.md wins over global for
   that repo; on conflicts between rules files, the named owner file wins (routing →
   model-routing.md; interaction → standards.md; implementation → coding-style.md;
   orchestration/lifecycle → orchestration.md).* (fixes RU-P4, RU-P5)
2. `orchestration.md` Model Routing section: *"model-routing.md is canonical; on divergence it wins."* (RU-P3)
3. High-rigor skill header: *"In high-rigor mode this protocol overrides orchestration.md
   where they conflict (commit cadence, approval phrases); everything not addressed here
   follows orchestration.md."* (RU-P2)

## File Changes

| File | Edit | Findings |
|:---|:---|:---|
| `rules/common/standards.md` | Delete second Mirroring-Rule statement (:46 block); merge "Ruthless Communication" into "Behavioral Personality"/"Token Economy" (keep every unique rule); Status Vocabulary → pointer to orchestration taxonomy (keep any marker unique to standards, fold into orchestration first). | RU-D5, RU-D7, RU-D8 |
| `rules/common/orchestration.md` | Model-routing detail (:24-52) → fleet-role table + pointer + precedence line; Command Fleet table → pointer to CLAUDE-global + keep Automatic Routing; high-rigor summary (:127-146) → existing pointer paragraph only; routing-lookup script commands (:45-51) deleted (live in repo CLAUDE.md); fleet scribe write-grant narrowed ("Artifacts docs not owned by another agent"); add AUDIT_REPORT.md persistence row. | RU-D1, RU-D2, RU-D9, RU-D10, RU-F11 |
| `CLAUDE-global.md` | Persistence layout (:113-155) → 3-line pointer + Root Files one-liner (post-OSH-3 correctness preserved); project-type routing → 2-line pointer; Mirroring Rule → pointer; learnings lifecycle → pointer; add Precedence block; Architecture map lists all 10 rules/common files. | RU-D3, RU-D4, RU-D5, RU-D6, RU-P4/P5, RU-S4-D4 |
| `rules/common/model-routing.md` | Cut to ~40 lines per Approach; move docs to `scripts/README.md`. | RU-T1, RU-D1, RU-S2 |
| `rules/common/high-rigor-engineering.md` → `skills/high-rigor-engineering/SKILL.md` | `git mv` + add skill frontmatter + precedence header; delete "Last updated" footer; register in overview + CLAUDE-global (per OSH-4 structure); remove from deploy rules expectations if enumerated. | RU-T2, RU-P2, RU-S2 |
| `rules/common/TOKEN-ECONOMICS.md` | Trim narration tables; keep actionable ~20-30 lines. | RU-T3 |
| `scripts/README.md` | Receive model-routing reference material (cost tables, YAML, monitoring template, verification anecdote). | RU-T1 |
| `skills/skills.overview.md` | Register high-rigor-engineering skill. | RU-T2 |

## Dependencies

**Prerequisites:** OSH-3 (names canonical) and OSH-4 (registries correct) — dedup must delete
copies against a correct master, and the new skill needs the corrected registry pattern.
**Enablements:** every future session pays ~550-650 fewer bootstrap lines.

## Verification

- Line counts before/after per file → `Artifacts/Temp/osh-5_linecounts.txt`; total always-loaded ≤ ~1,300.
- **Zero-loss check**: for each deleted block, the canonical home contains every behavioral
  rule from the deleted copy (reviewer diff pass; list block-by-block in evidence file).
- `/claude-md CLAUDE-global.md` rescore → ≥10/12, no zeros (fresh run, output saved).
- `/claude-md CLAUDE.md` (repo) still 12/12.
- Deploy; confirm `~/.claude/rules/` no longer contains high-rigor-engineering.md and the skill is present.

## Hard Rules (Auditor Rejects on Violation)

1. **Zero behavioral loss**: any rule present before and absent everywhere after = CRITICAL reject. The evidence file must map every deleted block → its canonical home.
2. Pointers replace copies — never a copy "trimmed down" in place (that recreates drift).
3. No new rules smuggled in during consolidation; this phase only moves and deletes.

## Success Metrics

- [ ] Always-loaded corpus ≤ ~1,300 lines (evidence: line counts)
- [ ] `/claude-md CLAUDE-global.md` ≥ 10/12, no zeros
- [ ] Each of RU-D1..D10 resolved to single-home + pointers
- [ ] Precedence stated for RU-P2..P5 pairs
- [ ] high-rigor available as on-demand skill; absent from deployed rules
- [ ] Deploy passes; auditor PASS with zero-loss map verified
