# CLAUDE.md Standards

**One-sentence definition**: `claude-md-standards` is the canonical quality bar for every
CLAUDE.md in this OS — what belongs in the **global** file vs a **project** file, how large
each may grow, and the anti-patterns that trigger rejection.

**Scope**: Governs `CLAUDE-global.md` (deployed to `~/.claude/CLAUDE.md`) and per-project
`CLAUDE.md` files. It is the grading standard the `/claude-md` command audits against.
It does **not** restate other rules — it references them.

---

## 1. The Prime Directive

A CLAUDE.md is **loaded into context on every turn**. Every line is a permanent tax on the
context window. Therefore: **maximum behavioral leverage per token.** If a line does not
change what the agent *does*, it does not belong here.

- A CLAUDE.md is **instructions**, not documentation. Docs live in `README.md` / `Artifacts/`.
- If a rule is universal, it belongs in `rules/common/*` and is *referenced*, not copied.
- Prose is expensive. Tables, bullets, and imperatives beat paragraphs.

---

## 2. Global vs Project — The Content Split

The single most important distinction. Content is filed by **blast radius**: does it apply to
*every* project (global) or *only this repo* (project)?

| Concern | Global (`CLAUDE-global.md`) | Project (`CLAUDE.md`) |
|:---|:---:|:---:|
| Agent fleet / roles / model routing | ✅ | — |
| Command registry (`/blueprint`, `/audit`, …) | ✅ | only repo-specific commands |
| `rules/common/*` pointers, orchestration lifecycle | ✅ | — |
| Artifacts/state-persistence discipline | ✅ | only if this repo deviates |
| Hooks / enforcement layer | ✅ | only repo-local hooks |
| Build / test / run commands for **this** repo | — | ✅ |
| This repo's directory layout & entry points | — | ✅ |
| This repo's deploy/release procedure | — | ✅ |
| Domain quirks, gotchas, "always do X here" | — | ✅ |
| Project-specific glossary / naming | — | ✅ |

**Litmus test**: *"Would this instruction still be true in a different repo?"*
Yes → global. No → project. If it appears in both, the project file is duplicating the
global — delete it from the project.

---

## 3. Size Discipline

Aligned with `rules/common/TOKEN-ECONOMICS.md` (standard bootstrap budget ~15k tokens; the
CLAUDE.md is one line item in that budget, not the whole thing).

| File | Target | Hard cap | On breach |
|:---|:---:|:---:|:---|
| Project `CLAUDE.md` | ≤ 150 lines / ~1.2k tokens | 250 lines | Extract to `README.md`/`Artifacts/` or a referenced rule |
| `CLAUDE-global.md` | ≤ 250 lines | 400 lines | Push detail into `rules/common/*`; keep only routing + pointers |

**Rule**: A CLAUDE.md that grows past target is a smell that documentation has leaked into
instructions. The fix is almost always *extract-and-reference*, never *shrink the font*.

---

## 4. Scored Quality Dimensions

`/claude-md` scores a target file 0–2 on each dimension (0 = absent/violated, 1 = partial,
2 = met). A healthy file scores ≥ 10/12 with no zeros.

| # | Dimension | 2 (met) | 0 (violated) |
|:--|:---|:---|:---|
| D1 | **Size discipline** | Within target for its type | Over hard cap |
| D2 | **No rule duplication** | References `rules/common/*` | Restates content owned by a rule file |
| D3 | **Correct split** | Only correct-tier content (§2) | Mixes global + project concerns |
| D4 | **Routing currency** | Every agent/command/path named still exists | Names a deleted agent/command/file |
| D5 | **Actionability** | Every line changes agent behavior | Contains narration, history, or filler |
| D6 | **Precedence clarity** | States what overrides what when rules conflict | Silent on conflicts |

---

## 5. Anti-Patterns (Auditor Rejects on Sight)

| Name | Definition |
|:---|:---|
| **Doc-creep** | Architecture prose, changelogs, or tutorials that belong in `README.md`/`Artifacts/` |
| **Rule-echo** | Copy-pasting `coding-style.md` / `security.md` / `standards.md` content instead of referencing it |
| **Tier-bleed** | Project-specific commands/paths in the global file, or global OS boilerplate in a project file |
| **Stale-routing** | Tables naming agents, commands, skills, or files that no longer exist |
| **Kitchen-sink** | Every possible instruction added "just in case" — no editing for leverage |
| **Silent-precedence** | Two instructions conflict and the file never says which wins |

---

## 6. Required Structure (both tiers)

A compliant CLAUDE.md is skimmable in one screen of headers:

1. **Identity** — one line: what this is (the OS / this repo).
2. **Map** — the tables/pointers an agent needs to route (global: fleet+commands; project: layout+commands).
3. **Local law** — anything that overrides defaults here, with explicit precedence.
4. **Pointers** — links to `rules/common/*`, `README.md`, `Artifacts/` for everything else.

No section earns its place unless an agent would behave *worse* without it (the Deletion Test,
per `rules/common/architecture.md`).

---

## 7. Maintenance

- **On-demand**: run `/claude-md [path]` to score a file against §4 and apply approved edits.
- **Trigger to re-audit**: an agent/command/skill/path is renamed or removed (→ D4 risk), or
  the file crosses its §3 target.
- **Never auto-edit**: `/claude-md` reports first; edits apply only on explicit confirmation.
