# Agent OS Cheatsheet

Quick reference for common commands, workflows, and navigation in Claude Code sessions.

---

## 🚀 Commands by Intent

| What You Want | Command | Owner | Use When |
|:---|:---|:---|:---|
| **Plan a feature/phase** | `/blueprint` | strategist | Starting a project or major refactor |
| **Fix a bug** | `/triage` | coder | Investigating root cause before implementation |
| **Review my work** | `/audit` | auditor | Before marking tasks complete |
| **End session** | `/handoff` | concierge | Wrapping up (saves context, learnings, briefs) |
| **Scan codebase** | `/sweep` | strategist | Looking for tech debt, redundancy, patterns |
| **Stress-test a plan** | `/grill` | strategist | Finding hidden risks or assumptions in a proposal |
| **Skill dependencies** | `/skill-graph` | strategist | Understanding skill ecosystem, optimize loading |
| **High-rigor decision** | `/council` | council | Resolving architectural conflict or consensus |
| **Validate manifest** | `/manifest` | concierge | Check project.json schema and plugins |
| **Sync filesystem** | `/sync` | concierge | Reconcile plan artifacts with actual code state |
| **Import external work** | `/ingest` | concierge | Register manual changes into project state |
| **Generate docs** | `/docs` | scribe | Create/update README, API docs, user guides |
| **Teach the code** | `/explain` | scribe | Walk through a codebase section |
| **Extract glossary** | `/glossary-extraction` | scribe | Capture ubiquitous language to GLOSSARY.md |

---

## 🎬 Common Workflows

### Workflow 1: Start a New Feature
```
1. /blueprint
   → Strategist asks: What? Why? Scope?
   → Creates IMPLEMENTATION_PLAN.md + TODO.md
   → Step 0 challenge (hidden risks)
   
2. [User approves plan]

3. [Strategist creates git branch: phase-N-description]

4. Coder implements (marks tasks [-])

5. /audit
   → Auditor validates gates (Logic, Style, Security)
   → Marks tasks [x] or rejects

6. /docs
   → Scribe updates README/API docs

7. /handoff
   → Concierge captures learnings, compresses context
   → Writes brief for next session
```

### Workflow 2: Debug a Bug
```
1. /triage
   → Coder investigates 4-phase root cause
   → Identifies minimal fix
   
2. Coder implements fix (1–2 files, <50 lines)

3. /audit
   → Auditor validates fix with regression tests
   
4. git commit + git push
```

### Workflow 3: Refactor a Module
```
1. /blueprint
   → Strategist designs deep module
   → Identifies seams and tests
   
2. Coder refactors (isolated, reversible)

3. /audit
   → Validate logic, style, test coverage
   
4. /handoff
   → Capture patterns for future refactors
```

### Workflow 4: End of Day
```
/handoff [--lite|--phase]
  → Saves TODO state
  → Captures learnings
  → Compresses context
  → Writes brief for next session
```

---

## 📂 Navigation: Where to Find Things

### Agent Overviews
```
agents/agents.overview.md         ← L1 routing: which agent to use for what
agents/strategist.md              ← Architecture, planning, ROI decisions
agents/coder.md                   ← Implementation, refactoring
agents/auditor.md                 ← Quality gates, testing, security review
agents/scribe.md                  ← Documentation, teaching, glossary
agents/concierge.md               ← Session lifecycle, state, sync
agents/council.md                 ← High-rigor deliberation, consensus
agents/creative-director.md       ← Visual spec, composition, hierarchy
```

### Skill Registry
```
skills/skills.overview.md         ← L1 discovery: all skills + how to trigger
skills/[skill-name]/SKILL.md      ← Full skill definition + instructions

optional_plugins/index.md         ← Plugin registry (singleton skills)
optional_plugins/[category]/      ← Plugin categories (youtube, pptx, etc.)
```

### Rules & Standards
```
rules/common/orchestration.md     ← Task lifecycle, git flow, conflict resolution
rules/common/coding-style.md      ← Language standards, immutability, density
rules/common/standards.md         ← Interaction protocol, communication
rules/common/security.md          ← Secrets, incident response, audits
rules/common/testing-strategy.md  ← Test lanes (Lane A/B), evidence rules
rules/common/architecture.md      ← Deep modules, design principles
rules/common/TOKEN-ECONOMICS.md   ← Context slicing, bootstrap costs
```

### Project State & Artifacts
```
Artifacts/
├── IMPLEMENTATION_PLAN.md      (high-level: all phases)
├── TODO.md                      (high-level: task tracking)
├── ARCH.md                      (system architecture)
├── MEMORY_ANCHORS.md            (project constants)
├── learnings/                   (persistent knowledge registry)
│
├── Plans/                       (active phase work)
│   ├── Phase-1-Plan.md          (created at phase start)
│   └── Phase-1-TODO.md          (created at phase start)
│
├── Reports/                     (phase completion)
│   └── Phase-1-Report.md        (created at phase end)
│
└── History/                     (archived artifacts)
    ├── DECISION_LOG.md
    ├── (old Plans/ and Reports/)
    └── (ad-hoc artifacts)
```

**Lifecycle:**
- Phase starts → Plans/Phase-N-Plan.md + Plans/Phase-N-TODO.md
- Phase completes → Reports/Phase-N-Report.md
- Phase archived → move Plans/ and Reports/ to History/
- learnings/ and MEMORY_ANCHORS.md stay at root (persistent)

### Templates
```
templates/project-youtube.json    ← V2 schema template (youtube projects)
templates/project-code.json       ← V2 schema template (code projects)
templates/project-geometry.json   ← V2 schema template (geometry projects)
[etc. for all project types]
```

---

## 🧪 Testing

### Quick Test
```bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_manifest_validator_v2.py -v

# Run specific test class
pytest tests/test_manifest_validator_v2.py::TestPluginRegistry -v

# Run specific test
pytest tests/test_manifest_validator_v2.py::TestPluginRegistry::test_registry_completeness -v
```

### Test Lanes (Choose the cheapest that proves the claim)

| Lane | Use For | Requires Rhino? | Speed |
|:---|:---|:---|:---|
| **Lane B — Pure** | Math, parsing, validation, data transforms | No | Fast ✓✓✓ |
| **Lane A — Headless** | RhinoCommon geometry (Breps, meshes) | Yes (Rhino.Inside) | Medium ✓✓ |
| **Lane A — Full** | UI, Grasshopper canvas, Rhino document | Yes (Full Rhino) | Slow ✓ |

**Rule**: Always start with Lane B. Only use Lane A if testing actual Rhino runtime behavior.

See [rules/common/testing-strategy.md](rules/common/testing-strategy.md) for details.

---

## 🔍 Skill Discovery

### Find a Skill by Purpose
```
1. Open skills/skills.overview.md
2. Scan "Category" column for your domain
3. Find skill name, read description
4. If it fits, refer to it in your task
```

### Example: "I need to debug something"
```
→ Search skills/skills.overview.md for "debug"
→ Found: systematic-debugging (coder, auditor)
→ Automatically loaded for code projects
→ If not loaded, add to active_skills in project.json
```

### Example: "I need to optimize a Rhino component"
```
→ Search for "rhino"
→ Found: python-rhino-grasshopper, rhino-e2e-testing, rhino-unit-testing
→ Check if auto-enabled for geometry projects
→ If custom project, add to plugins array in project.json (V2)
```

---

## 📋 Project Manifest (project.json)

### V1 Schema (Legacy)
```json
{
  "project_type": "code",
  "auto_include": true,
  "active_skills": ["python-mcp"],
  "disabled_skills": []
}
```

### V2 Schema (Current)
```json
{
  "project_type": "code",
  "schema_version": "2.0.0",
  "auto_include": true,
  "plugins": [
    {"plugin_id": "code-mcp-tools", "enabled": true, "version": "1.0.0"}
  ]
}
```

### Project Types & Auto-Plugins
| Type | Auto-Enabled Plugin | Canonical Template |
|:---|:---|:---|
| **youtube** | youtube-core | project-youtube.json |
| **code** | code-mcp-tools | project-code.json |
| **geometry** | geometry-rhino | project-geometry.json |
| **pptx** | ms-office-core, visual-storytelling-core | project-pptx.json |
| **pbi-report** | pbi-core | project-pbi.json |
| **data** | pbi-core | project-data.json |
| **manuscript** | manuscript-tools | project-manuscript.json |
| **hybrid** | (none) | project-hybrid.json |
| **minimal** | (none) | project-minimal.json |

### V1→V2 Auto-Upgrade
- V1 manifests (no `schema_version`) auto-upgrade to V2 on first validation
- Upgrade is **transparent**: no user intervention, all V1 fields preserved
- Plugins array is **inferred** from project_type

---

## 🛡️ Security Quick Reference

### Secrets Management
```
✓ DO: Use environment variables at runtime
✓ DO: Store secrets in .env (local) or vault (prod)
✓ DO: Add .env to .gitignore before first commit
✗ DON'T: Hardcode API keys, tokens, connection strings
✗ DON'T: Commit .env files
```

### Input Validation
```
✓ DO: Validate user input at system boundaries
✓ DO: Use Pydantic (Python) or Zod (TypeScript)
✗ DON'T: Trust user-provided filenames, paths, layer names
✗ DON'T: Use eval(), exec(), yaml.load() on untrusted input
```

### If You Suspect a Security Issue
```
1. FREEZE: Stop implementation
2. AUDIT: Full codebase sweep
3. REMEDIATE: Fix vulnerability + rotate secrets
4. VERIFY: Auditor confirms CLEAN status
5. RESUME: Log incident in DECISION_LOG.md
```

See [rules/common/security.md](rules/common/security.md) for full protocol.

---

## 💾 Phase 11: Plugin System (Quick Reference)

### What Changed
- **13 singleton skills** moved to `optional_plugins/` (lazy-loaded)
- **9 universal skills** remain in `skills/` (always available)
- **V2 schema** with `plugins` array for per-project plugin configuration

### The 13 Singleton Skills (Now Plugins)
```
youtube/
  ├── youtube-strategy
  ├── youtube-scriptwriting
  └── youtube-retention

pptx/
  └── pptx

pbi-report/
  └── powerbi-report

code-mcp/
  ├── python-mcp
  └── typescript-mcp

geometry/
  ├── cd-foundations
  ├── python-rhino-grasshopper
  ├── rhino-e2e-testing
  └── rhino-unit-testing

manuscript/
  ├── manuscript-review
  └── business-analyst
```

### Migration State
```
Migration script: scripts/migrate_skills_to_plugins.py
  --dry-run   → Show what would be removed
  --apply     → Execute migration (13 skills removed from skills/)
  --rollback  → Restore from git backup

Rollback procedure: Artifacts/ROLLBACK_PROCEDURE.md
Migration state: Artifacts/.agent/migration_state.json (audit trail)
Release tag: v11.0.0-plugin-system
```

### Token Impact
- **Before**: All 22 singleton + core skills loaded at bootstrap
- **After**: Only 9 core skills + enabled plugins (15–25% reduction for 1–2 plugins)

---

## ⚡ Pro Tips

### 1. Always run /sync before starting work
```bash
/sync
→ Reconciles TODO.md with actual code state
→ Picks up manual changes
→ Ensures plan matches reality
```

### 2. Mark tasks [-] before implementing
```bash
# In TODO.md:
- [-] [coder] Implement feature X
```
Tells auditor that work is in progress.

### 3. Let /audit mark [x] completion
```bash
# Only auditor can mark [x]
- [x] [coder] Implement feature X — Success: all gates pass
```
Prevents incomplete work from masquerading as done.

### 4. Use /grill before big decisions
```bash
/grill [your-plan-text]
→ Stress-tests for hidden risks
→ Surfaces assumptions
→ Prevents costly pivots mid-implementation
```

### 5. Check learnings before starting
```bash
Artifacts/learnings/
→ Patterns from past phases
→ Known pitfalls
→ Reuse solutions (don't reinvent)
```

### 6. Always use venv for Python work
```bash
.venv\Scripts\activate
python scripts/...
pytest tests/
```
Never use global pip or system Python.

---

## 🆘 Common Issues & Solutions

### "Skill X not found"
1. Check skills/skills.overview.md for exact name
2. Verify skill is enabled in project.json (active_skills or plugins)
3. For plugins: confirm project_type matches plugin's auto_type
4. Run /sync to reload skill registry

### "Test Y failed"
1. Read the assertion message carefully
2. Check rules/common/testing-strategy.md for lane selection
3. For Lane B: verify no Rhino dependencies
4. For Lane A: verify Rhino.Inside/full Rhino available
5. Run with `-vv` flag for detailed output: `pytest -vv tests/test_name.py`

### "Manifest validation error"
1. Ensure project.json has `project_type`
2. For V2: confirm `schema_version: "2.0.0"`
3. Run: `python scripts/manifest_validator.py --list-plugins`
4. Check PLUGIN_REGISTRY in scripts/manifest_validator.py

### "Changes not showing up"
1. Run /sync to reconcile filesystem with TODOs
2. Commit and push changes
3. Check git status: `git status`
4. Verify branch is correct: `git branch`

---

## 📚 Further Reading

| Topic | Resource |
|:---|:---|
| Full agent definitions | [agents/](agents/) |
| Skill writing guide | [/.claude/skills/skill-creator/](/.claude/skills/skill-creator/) |
| Coding standards | [rules/common/coding-style.md](rules/common/coding-style.md) |
| Orchestration & task flow | [rules/common/orchestration.md](rules/common/orchestration.md) |
| Testing strategy & lanes | [rules/common/testing-strategy.md](rules/common/testing-strategy.md) |
| Security protocols | [rules/common/security.md](rules/common/security.md) |
| Plugin system walkthrough | [optional_plugins/README.md](optional_plugins/README.md) |
| Rollback procedure | [Artifacts/ROLLBACK_PROCEDURE.md](Artifacts/ROLLBACK_PROCEDURE.md) |

---

**Last updated**: July 3, 2026  
**Latest phase**: Phase 11 (Plugin System MVP) — Complete  
**Release tag**: v11.0.0-plugin-system
