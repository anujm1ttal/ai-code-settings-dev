# Phase 11: Optional Plugin System — Executive Summary

**Objective**: Reduce AI OS bootstrap overhead by moving 12 rarely-used domain skills to an optional plugin system.

**Scope**: Architecture and design only. No implementation approved yet.

**Timeline**: 3 weeks (Jul 21 – Aug 10). Non-blocking for ongoing work.

---

## The Problem

Current AI OS loads ALL 35 skills on every project boot, regardless of project type:
- **Bootstrap cost**: 6,000–7,600 tokens per session
- **Wasted context**: Singleton skills (used by only 1 project type) loaded for irrelevant projects
- **Example**: A code project loads youtube-strategy, powerbi-report, and cd-foundations (completely unused)

---

## The Solution: Optional Plugins

Move 12 singleton skills to `optional_plugins/[category]/[skill]/` and lazy-load only when project type matches:

```
skills/                              (BEFORE)
├─ youtube-strategy                  
├─ typescript-mcp                    
├─ cd-foundations                    
├─ ... (35 skills total)             

skills/                              (AFTER)
├─ [foundational 7]
├─ [universal 9]
├─ (singletons REMOVED)

optional_plugins/
├─ youtube/
│   ├─ youtube-strategy
│   ├─ youtube-scriptwriting
│   └─ youtube-retention
├─ geometry/
│   ├─ cd-foundations
│   ├─ python-rhino-grasshopper
│   ├─ rhino-e2e-testing
│   └─ rhino-unit-testing
├─ pptx/
├─ pbi-report/
├─ code-mcp/ (typescript-mcp, python-mcp)
└─ manuscript/
```

---

## 12 Singleton Skills Identified

| # | Skill | Project Type | Why Plugin? |
|:---|:---|:---|:---|
| 1–3 | youtube-{strategy, scriptwriting, retention} | youtube | Niche content domain; not useful elsewhere |
| 4 | pptx | pptx | Presentation-only; rarely overlaps |
| 5 | powerbi-report | pbi-report | BI-specific visual patterns |
| 6–7 | typescript-mcp, python-mcp | code | MCP/backend-specific |
| 8–11 | cd-foundations, python-rhino-grasshopper, rhino-e2e-testing, rhino-unit-testing | geometry | Rhino/GH runtime-specific |
| 12 | manuscript-review | manuscript | Publishing domain-specific |

**NOT moved** (remain in core):
- Foundational (7): codebase-navigator, systematic-debugging, implementation-dispatch, etc.
- Universal (9): python-patterns, visual-composition, dax-modeling, business-analyst, skill-creator, banana-prompt, glossary-extraction, docx, xlsx

---

## Token Impact (Projected)

### Before Plugin System (All Skills Loaded)
```
Foundational + Universal:     2,800 tokens
Project-specific + Singletons: 3,800 tokens
─────────────────────────────────────────
TOTAL:                        6,600 tokens
```

### After Plugin System (Auto-Optimized)
```
Foundational + Universal:     2,000 tokens
Plugin Registry Metadata:       300 tokens
Lazy-Loaded Plugins:           2,800 tokens (only if project type matches)
─────────────────────────────────────────
YOUTUBE project:              5,100 tokens  (20% savings)
CODE project:                 5,100 tokens  (23% savings)
GEOMETRY project:             6,700 tokens  (8% savings, more complex)
AVERAGE:                       18–22% savings across all project types
```

---

## How It Works (No Code Changes for Users)

1. **Backward Compatible**: Old `project.json` (V1) auto-upgrades to V2 silently. No user action required.

2. **Auto-Enable**: When `auto_include=true`, plugins automatically load based on `project_type`:
   ```json
   // V1 (old)
   { "project_type": "youtube", "auto_include": true }
   
   // ↓ Auto-upgraded to V2 (transparent)
   
   { "project_type": "youtube", "schema_version": "2.0.0",
     "skills_config": {
       "plugins": [
         { "plugin_id": "youtube-core", "enabled": true }
       ]
     }
   }
   ```

3. **Lazy-Loading**: Plugins only injected into agent context if:
   - User's `project_type` matches plugin's `project_types`
   - User's `auto_include=true` (or explicitly enables plugin)
   - `/sync` detects plugin in manifest and loads it

4. **No Fallback Needed**: All singleton skills remain in `optional_plugins/`; they're never deleted, just relocated.

---

## Three-Phase Implementation

### Phase 11.1: Infrastructure (Week 33, Jul 21–27)
- Create `optional_plugins/` directory structure
- Write plugin metadata schema (YAML)
- Update manifest validator to support V2 schema
- **Success**: Validator passes tests for V1 & V2

### Phase 11.2: Copy & Validate (Week 34, Jul 28–Aug 3)
- Copy all 12 skills to plugin directories
- Create `plugin.yaml` (category metadata) + `METADATA.yaml` (skill metadata)
- Update 9 project templates
- **Success**: All 12 skills validated; no diff between `skills/` and `optional_plugins/`

### Phase 11.3: Deactivation (Week 35, Aug 4–10)
- Run migration script (idempotent, reversible)
- Delete singleton skills from `skills/` (after auditor approval)
- Test backward compatibility on 3 test projects
- Validate token savings
- **Success**: All tests pass; rollback procedure functional

---

## Risk Mitigation

| Risk | Severity | Mitigation |
|:---|:---|:---|
| Breaking backward compat | CRITICAL | Auto-upgrade V1→V2; test both formats pre-merge |
| Plugin discovery fails | CRITICAL | Hard-coded fallback to `skills/` if plugins unavailable |
| Token estimates off | HIGH | Instrument actual usage via `/manifest --analyze` |
| Skill references break | HIGH | Validate all cross-skill links; update relative paths |
| Incomplete metadata | HIGH | Auditor enforcement: all skills require `METADATA.yaml` |

**Rollback**: If Phase 11.3 fails audit or causes >3 integration failures, revert via:
```bash
git restore skills/ optional_plugins/
```
Takes ~30 minutes; no data loss.

---

## Success Criteria

- **Phase 11.1**: Validator accepts V1 & V2 schemas; zero lint violations
- **Phase 11.2**: All 12 skills copied; spot-check validation PASS; templates updated
- **Phase 11.3**: Migration script functional; V1→V2 upgrade validated; token savings ≥15%; rollback tested; auditor PASS
- **Token Impact**: Verified 15%+ savings on 3 project types via `/manifest --analyze`

---

## What Users See

**No Changes**:
- Agent behavior identical
- Skill instructions unchanged
- `/blueprint`, `/sync`, `/audit` workflows unchanged

**Behind the Scenes**:
- Smaller bootstrap footprint (18–22% faster)
- Manifest validator now handles both V1 and V2
- Plugin metadata available for future skill discovery UI

---

## Artifacts Generated

| File | Purpose |
|:---|:---|
| `Artifacts/PHASE_11_PLUGIN_SYSTEM.md` | Full technical spec (Parts 1–11) |
| `Artifacts/PHASE_11_TECHNICAL_REFERENCE.md` | Implementation guide (pseudocode, schemas, tests) |
| `Artifacts/PHASE_11_EXECUTIVE_SUMMARY.md` | This document (high-level overview) |
| `Artifacts/TODO.md` | 24 tasks across 3 phases |
| `Artifacts/MEMORY_ANCHORS.md` | Updated with Phase 11 anchor points |

---

## Next Steps

**For Approval**:
1. Review this summary
2. Review detailed spec (`PHASE_11_PLUGIN_SYSTEM.md`)
3. Confirm Phase 11 is aligned with broader roadmap priorities
4. Approve or request changes

**To Begin Phase 11.1**:
1. User approves plan
2. Create branch: `phase-11-plugin-system`
3. Coder begins Phase 11.1 tasks (infrastructure)
4. Auditor validates schema & validator updates

**Estimated Effort**:
- Human team: 2–3 weeks
- AI-assisted: 12–16 hours (compressed from ~40 human-hours)
- Compression: ~2.5x speedup via scaffolding + schema automation

---

## Decision Point

**APPROVAL REQUESTED**: Phase 11 plan execution authority

- [ ] Approve Phase 11 as planned (start Week 33)
- [ ] Request changes (list specific modifications)
- [ ] Defer to later phase (document reason)
- [ ] Reject (feedback appreciated)

**Approval Label**: `[APPROVE] · [REVERSIBLE] · [PROJECT]` (plugin system is fully rollback-safe)

---

**Status**: Ready for user review and approval.
**Date**: 2026-07-03
**Strategist**: Agent OS Architect
