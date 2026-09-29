---
name: claude-md-standards
description: Grading standard for CLAUDE.md / CLAUDE-global.md files — size, split, precedence.
paths: ["**/CLAUDE.md", "**/CLAUDE-global.md", "**/CLAUDE.local.md", "**/CLAUDE.md.template"]
---

# CLAUDE.md Standards

Grading standard `/claude-md` audits against. Governs `CLAUDE-global.md` and per-project
`CLAUDE.md` files. References other rules, never restates them.

**Prime directive**: a CLAUDE.md loads every turn — every line is a permanent token tax.
Instructions, not documentation (docs → `README.md`/`Artifacts/`). Universal rules belong in
`rules/common/*`, referenced not copied.

**Global vs. project split** — litmus test: *"Would this instruction still be true in a
different repo?"* Yes → global (agent fleet, command registry, rules pointers, hooks). No →
project (build/test/run commands, this repo's layout, deploy procedure, domain quirks). Content
in both means the project file is duplicating global — delete it from the project.

**Size**: project `CLAUDE.md` ≤150 lines (hard cap 250); `CLAUDE-global.md` ≤250 lines (hard
cap 400) — extract-and-reference on breach, never shrink the font.

**Scored 0–2 per dimension** (healthy file: ≥10/12, no zeros):

| # | Dimension | 2 (met) | 0 (violated) |
|:--|:---|:---|:---|
| D1 | Size discipline | Within target | Over hard cap |
| D2 | No rule duplication | References `rules/common/*` | Restates a rule file |
| D3 | Correct split | Only correct-tier content | Mixes global + project |
| D4 | Routing currency | Every named agent/command/path exists | Names something deleted |
| D5 | Actionability | Every line changes behavior | Narration, history, filler |
| D6 | Precedence clarity | States what overrides what | Silent on conflicts |

**Anti-patterns, reject on sight**: Doc-creep (architecture prose/tutorials that belong
elsewhere), Rule-echo (copy-pasting a rule file instead of referencing it), Tier-bleed
(project content in global or vice versa), Stale-routing (names something that no longer
exists), Kitchen-sink (everything "just in case"), Silent-precedence (unresolved conflict).

**Required structure**: Identity (one line) → Map (routing tables/pointers) → Local law
(overrides, with precedence) → Pointers (`rules/common/*`, `README.md`, `Artifacts/`).

**Maintenance**: `/claude-md [path]` scores and reports first — never auto-edits; applies only
on confirmation. Re-audit trigger: a named agent/command/skill/path is renamed or removed, or
the file crosses its size target.
