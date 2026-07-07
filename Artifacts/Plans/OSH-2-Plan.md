# Phase OSH-2: Fix Broken Gates & Capability Mismatches

**Initiative:** OSH — OS Hardening · **Findings:** AUDIT_REPORT.md §2 (AG-*), §3 (CM-1,3,6,7,8,11,12,25)
**Branch:** `phase-osh-2-agent-gates` · **Owner:** coder → auditor

## Objectives

Remove every instruction that is currently *unexecutable or wrong*: agents mandated to write
files without Write tools, hard gates pointing at nonexistent agents/skills/paths, command
procedures that violate the OS's own authority rules, and dead cross-references. After this
phase, every mandate in agents/ and the affected commands is executable exactly as written.

## Technical Approach

**Capability decisions (approved defaults — coder implements, does not re-litigate):**
- **Auditor** gets `Edit, Write` added to tools; description drops "Read-only", keeps "only
  agent authorized to mark `[x]`". Rationale: orchestration's fleet table already assigns it
  two write targets; the alternative (advisory-only) would ripple through /audit, /sync, and
  the TODO authority model.
- **Council** gets `Write, Edit` (owns DECISION_LOG.md). Advisory posture otherwise unchanged.
- **strategist, scribe, concierge, creative-director** each add `Edit` (diff-protocol compliance).
- **/audit TODO authority (CM-1):** auditor writes Action Items into `AUDIT_REPORT.md` and
  files loose items to `Artifacts/BACKLOG.md`; it never adds TODO tasks. orchestration.md
  authority table stands unchanged.

**Dead-reference policy:** point at what exists today. Geometry resources live at
`optional_plugins/geometry/skills/python-rhino-grasshopper/resources/` — gates must note
"when the geometry plugin is installed". Phantom `csharp-grasshopper` → `python-rhino-grasshopper`
(which carries the C#/RhinoCommon standards per coding-style.md).

## File Changes

| File | Edit | Findings |
|:---|:---|:---|
| `agents/auditor.md` | Frontmatter: `tools: Read, Grep, Glob, Bash, Edit, Write`; description drop "Read-only —", keep `[x]` authority (:4-5). Replace `visual-auditor` dispatch with `subagent_type: auditor` + `visual-composition` skill; keep the PASS gate (:22). Fix geometry resources path + plugin-presence note; `grep_search` → Grep (:30). Resolve clean-room dispatch to `subagent_type: scribe`, delete contradictory half (:40). Fix `csharp-grasshopper` → `python-rhino-grasshopper` (:95). Delete orphaned fleet-table fragment (:55-57). Severity scale: replace truncated redefinition with pointer to orchestration Standard Taxonomies (:127-129). | AG-1, AG-3, AG-4, AG-6, AG-7, AG-14, AG-16 |
| `agents/council.md` + `council.abstract.md` | Add `Write, Edit` to tools (:5). Reword "final architectural authority" → "produces consensus recommendation; strategist retains final architectural authority (orchestration.md)" (:14; abstract :6,:10). | AG-2, AG-8 |
| `agents/coder.md` | Fix geometry resources path (:44). Route code-change subagents to `subagent_type: coder` (:59). | AG-4, AG-17 |
| `agents/strategist.md` | Frontmatter + `Edit` tool; description `Artifacts/PLAN.md` → `Artifacts/IMPLEMENTATION_PLAN.md` (:4). `business-analyst` requirement → "when available (core after OSH-4; see SK-9)" (:16) — OSH-4 relocates the skill; this phase only unblocks the mandate wording. | AG-5, AG-13, AG-11 |
| `agents/scribe.md` | Add `Edit`. Append root-README exception to the Artifacts-only rule (:25). | AG-13, AG-20 |
| `agents/concierge.md` + `concierge.abstract.md` | Add `Edit`. Owned Commands: add `/clean`, `/graduate` (:42-47). Delete orphaned table fragment (:13-15). Abstract: `Artifacts/learnings/` registry; drop DECISION_LOG claim (:8). | AG-13, AG-10, AG-14, AG-9 |
| `agents/creative-director.md` | Add `Edit`. | AG-13 |
| `agents/geometry-validator.md` | Name the resources path explicitly (plugin location); split "closed (is_manifold)" into closure (`Brep.IsSolid`) and manifoldness (`IsManifold`) checks (:19,:25). | AG-19 |
| `agents/agents.overview.md` | Replace `file:///c:/Users/44547/...` links with relative `./<agent>.abstract.md` (:7-14). | AG-15 |
| `commands/audit.md` | Action Items → AUDIT_REPORT.md + BACKLOG.md, never TODO.md; flag-for-strategist wording (:21,:36). Fix scribe/auditor dispatch contradiction — one agent (:41). `csharp-grasshopper` → `python-rhino-grasshopper` (:34). Delete stale "Skill Registry Consistency" section; reference /registry-audit (:139-145). | CM-1, CM-11, CM-6, CM-19 |
| `commands/script.md` | Output → `Artifacts/SCRIPT.md` (:20). `/review` → `/audit` (:23). | CM-3, CM-25 |
| `commands/pack.md` | Precondition → `Artifacts/SCRIPT.md`; output → `Artifacts/METADATA.md` (:12,:26). | CM-3 |
| `commands/registry-audit.md` | Drop `global_workflows/` (:22); add CLAUDE-global.md + repo CLAUDE.md to every checklist item; report → `Artifacts/REGISTRY_HEALTH_REPORT.md` (:40). `grep_search`/`list_dir` → Grep/Glob (:37-38). | CM-8, CM-12 |
| `commands/snapshot.md` | `grep_search`/`list_dir` → Grep/Glob (:12). | CM-12 |
| `commands/deck.md` | Insert missing `### /deck audit [--team]` heading + **Agent**: auditor above :42. | CM-7 |
| `optional_plugins/manuscript/skills/business-analyst/SKILL.md` | `csharp-grasshopper` ref → `python-rhino-grasshopper` (:111). | AG-7 |
| `rules/common/orchestration.md` | Fleet table: auditor row Write targets unchanged (now executable); council row unchanged. **No authority-model change.** (Verification-only touch; registry edits happen in OSH-4/5.) | AG-1 sanity |

## Dependencies

**Prerequisites:** OSH-1 (deployed guard hooks emit correct schemas before agent files start being edited under them; not blocking-critical but ordered).
**Enablements:** OSH-4 registry work assumes agent files are internally consistent; strategist's business-analyst wording pre-references SK-9 (OSH-4).

## Verification

- `grep -rn "visual-auditor\|csharp-grasshopper\|grep_search\|list_dir" agents/ commands/ optional_plugins/` → 0 hits.
- `grep -rn "skills/python-rhino-grasshopper" agents/ commands/` → 0 hits (all point at plugin path).
- `grep -n "file:///" agents/agents.overview.md` → 0.
- Manual: each edited frontmatter parses (valid YAML), tool lists match plan table exactly.
- Deploy + spot-check one deployed agent file matches repo.

## Hard Rules (Auditor Rejects on Violation)

1. **No authority-model changes**: the TODO authority table (who marks `[ ]`/`[-]`/`[x]`) is untouched; only tool grants and file-write mandates are aligned to it.
2. **Surgical scope**: no rewriting of agent prompt content beyond the findings listed — no "improvements" to role descriptions, boundaries, or examples.
3. Every replaced reference must point at a path/agent/skill that exists **today** (verify with Glob before writing).

## Success Metrics

- [ ] Zero phantom references (grep matrix above all 0)
- [ ] All 8 agent frontmatters: tools sufficient for every write mandate in their body
- [ ] /audit no longer instructs TODO task insertion; /pack gate matches /script output path
- [ ] Auditor PASS; deployed copies match repo
