# ai-code-settings

**Claude Code AI OS** — An orchestration layer for structured, multi-agent AI development workflows.

This repository contains the global ruleset, agent definitions, skill modules, and templates that power Claude Code sessions across all projects. It serves as a centralized registry for architectural patterns, coding standards, security protocols, and domain expertise.

---

## 🎯 What Is This?

The AI OS provides:

1. **Agents** — Role-based personas (strategist, coder, auditor, scribe, council, creative-director, concierge) with specific capabilities and authority boundaries
2. **Rules** — Canonical standards for coding style, architecture, security, testing, and interaction
3. **Skills** — Domain-specific modules for YouTube, PowerBI, Rhino/Grasshopper, Python/TypeScript MCP, and more
4. **Plugins** — Optional singleton skills packaged for lazy-loading and token optimization (Phase 11 MVP)
5. **Commands** — Procedural workflows (`/blueprint`, `/audit`, `/handoff`, `/sweep`, `/council`, etc.)

Think of it as a **knowledge base and execution framework** that makes AI agents more reliable, rigorous, and aligned with your project's standards.

---

## 🚀 Quick Start

### For Claude Code Users

1. **Run a session**: Open any project and start Claude Code
   - The system auto-loads `project.json` and determines active skills
   - All rules and agent definitions are available to the AI

2. **Use commands**:
   ```
   /blueprint          Plan a new feature or phase
   /triage             Investigate and fix bugs
   /audit              Quality gate validation
   /handoff            Summarize session and save state
   /sweep              Scan codebase for tech debt
   /council            High-rigor deliberation on architecture
   ```

3. **Check the cheatsheet**: See [cheatsheet.md](cheatsheet.md) for quick reference

### For Developers/Maintainers

1. **Navigate the registry**:
   - [agents/agents.overview.md](agents/agents.overview.md) — Agent L1 routing map
   - [skills/skills.overview.md](skills/skills.overview.md) — Skill registry and discovery
   - [rules/common/](rules/common/) — Canonical standards

2. **Update rules**: Edit files in `rules/common/` (changes affect all sessions)
   - `orchestration.md` — Agent routing, task lifecycle
   - `coding-style.md` — Language-specific standards, immutability rules
   - `standards.md` — Interaction protocol, communication style
   - `security.md` — Secret management, incident response

3. **Create skills**: Use the [skill-creator](/.claude/skills/skill-creator/) to design new domain modules

4. **Run tests**: `pytest tests/` to validate manifest schema and plugin integrity

---

## 📁 Directory Structure

```
ai-code-settings/
├── README.md (this file)
├── cheatsheet.md                    # Quick reference for common commands
├── project.json                     # Global manifest (V2 schema)
│
├── agents/                          # Agent role definitions
│   ├── agents.overview.md           # L1 routing map
│   ├── strategist.md                # Architecture, planning, ROI
│   ├── coder.md                     # Implementation, refactoring
│   ├── auditor.md                   # QA, technical review, gates
│   ├── scribe.md                    # Documentation, teaching
│   ├── council.md                   # Deliberation, consensus
│   ├── creative-director.md         # Visual spec, composition
│   └── concierge.md                 # State, sync, lifecycle
│
├── rules/common/                    # Canonical standards (all projects)
│   ├── orchestration.md             # Agent lifecycle, task flow
│   ├── coding-style.md              # Language patterns, immutability
│   ├── standards.md                 # Interaction, communication
│   ├── security.md                  # Secrets, incident response
│   ├── testing-strategy.md          # Test lanes, evidence rules
│   ├── architecture.md              # Deep modules, design principles
│   ├── TOKEN-ECONOMICS.md           # Context slicing, bootstrap costs
│   └── README.md                    # Rules overview
│
├── skills/                          # Universal core skills (always available)
│   ├── skills.overview.md           # L1 skill discovery map
│   ├── codebase-navigator/          # Search, grep, find patterns
│   ├── systematic-debugging/        # 4-phase root-cause analysis
│   ├── project-planner/             # Phased roadmaps, dependencies
│   ├── project-journal/             # Session history, decision logs
│   ├── implementation-dispatch/     # Subagent orchestration
│   ├── python-patterns/             # Python idioms, best practices
│   ├── verification-gate/           # Testing strategy, evidence
│   ├── doc-updater/                 # Automated documentation sync
│   └── ... (9 total universal skills)
│
├── optional_plugins/                # Singleton skills (lazy-loaded, Phase 11)
│   ├── index.md                     # Plugin registry overview
│   ├── plugin_manifest_schema.json  # JSON Schema for validation
│   ├── README.md                    # Migration guide
│   │
│   ├── youtube/
│   │   ├── plugin.yaml
│   │   ├── youtube-strategy/
│   │   ├── youtube-scriptwriting/
│   │   └── youtube-retention/
│   ├── pptx/
│   │   ├── plugin.yaml
│   │   └── pptx/
│   ├── pbi-report/
│   │   ├── plugin.yaml
│   │   └── powerbi-report/
│   ├── code-mcp/
│   │   ├── plugin.yaml
│   │   ├── python-mcp/
│   │   └── typescript-mcp/
│   ├── geometry/
│   │   ├── plugin.yaml
│   │   ├── cd-foundations/
│   │   ├── python-rhino-grasshopper/
│   │   ├── rhino-e2e-testing/
│   │   └── rhino-unit-testing/
│   └── manuscript/
│       ├── plugin.yaml
│       ├── manuscript-review/
│       └── business-analyst/
│
├── templates/                       # Project manifest templates
│   ├── project-youtube.json         # V2 schema template
│   ├── project-code.json
│   ├── project-geometry.json
│   ├── project-data.json
│   ├── project-pbi.json
│   ├── project-pptx.json
│   ├── project-manuscript.json
│   ├── project-hybrid.json
│   └── project-minimal.json
│
├── scripts/                         # Utility scripts
│   ├── manifest_validator.py        # V1→V2 schema validation, plugin registry
│   ├── migrate_skills_to_plugins.py # Migration with --dry-run, --apply, --rollback
│   └── ... (other automation scripts)
│
├── tests/                           # Test suite
│   ├── test_manifest_validator_v2.py    # 46 tests (schema, plugins, backward compat)
│   ├── test_v1_v2_migration.py          # 11 tests (auto-upgrade scenarios)
│   └── ... (other tests)
│
└── Artifacts/                       # Project state (workspace-specific)
    ├── CLAUDE.md                    # Local overrides to global rules
    ├── TODO.md                      # Phase tracking and task status
    ├── IMPLEMENTATION_PLAN.md       # Technical design and roadmap
    ├── MEMORY_ANCHORS.md            # Project-specific constants
    ├── DECISION_LOG.md              # High-stakes pivots and resolutions
    ├── learnings/                   # Persistent knowledge registry
    ├── history/                     # Archived plans and decisions
    ├── Temp/                        # Transient scripts and analysis
    ├── .agent/                      # Internal state (migration, tasks)
    └── ROLLBACK_PROCEDURE.md        # Manual reversal for plugin migration
```

---

## 🧠 Core Concepts

### Agents & Authority

Each agent has specific capabilities and task authority:

| Agent | Role | Can Write | Authority |
|:---|:---|:---|:---|
| **strategist** | Architecture, planning | IMPLEMENTATION_PLAN.md, TODO.md (structure) | Final say on design decisions |
| **coder** | Implementation | Source code, tests | Marks tasks `[-]` (in progress) |
| **auditor** | Quality gates | AUDIT_REPORT.md, TODO.md (marks `[x]`) | Final sign-off on deliverables |
| **scribe** | Documentation | All Markdown docs (except README.md) | Keeps docs in sync with code |
| **concierge** | State & lifecycle | TODO.md pruning, learnings, sync | Session orchestration |
| **council** | High-rigor deliberation | DECISION_LOG.md | Conflict resolution |
| **creative-director** | Visual spec | LAYOUT_SPEC.md | Look-and-feel authority |

### Skills

Skills are modular expertise units. Two types:

1. **Universal Core Skills** (always available in `skills/`)
   - Available to all project types
   - Examples: codebase-navigator, systematic-debugging, project-planner

2. **Optional Singleton Skills** (lazy-loaded from `optional_plugins/`)
   - Project-type-specific (youtube, pptx, geometry, etc.)
   - Auto-enabled if `auto_include: true` in manifest
   - Can be disabled per project

### Manifests: V1 vs V2

**V1 Schema** (legacy):
```json
{
  "project_type": "code",
  "auto_include": true,
  "active_skills": ["python-mcp"],
  "disabled_skills": []
}
```

**V2 Schema** (current, with plugins):
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

**Auto-Upgrade**: V1 manifests automatically upgrade to V2 on first validation (transparent, backward compatible).

---

## 🔧 Common Workflows

### 1. Plan a New Feature
```bash
/blueprint
# Strategist interviews requirements → Phases → Step 0 challenge → Git branch
```

### 2. Fix a Bug
```bash
/triage
# Coder investigates → Root cause → Minimal fix → Auditor verifies
```

### 3. Review Code Quality
```bash
/audit
# Auditor validates → Logic/Style/Security gates → [PASS] or [FAIL] with specifics
```

### 4. End a Session
```bash
/handoff
# Concierge captures learnings, compresses context, writes brief for next session
```

### 5. Explore Tech Debt
```bash
/sweep
# Strategist scans codebase → Redundancy map → Cleanup recommendations
```

---

## 🛡️ Security

All secrets managed via environment variables or secure vaults:
- **Local dev**: `.env` (git-ignored)
- **Production**: Azure Key Vault, 1Password CLI, or equivalent
- **Never commit**: API keys, tokens, connection strings, local paths

See [rules/common/security.md](rules/common/security.md) for incident response procedures.

---

## 📊 Testing & Validation

All changes validated via test suite:

```bash
# Run all tests
pytest tests/ -v

# Run specific test class
pytest tests/test_manifest_validator_v2.py::TestPluginRegistry -v

# Check manifest on a project
python scripts/manifest_validator.py --list-plugins
```

**Test lanes**:
- **Lane B (Pure)**: No Rhino/external runtime (fastest, default)
- **Lane A (Headless)**: RhinoCommon via Rhino.Inside
- **Lane A (Full)**: Full Rhino UI environment

See [rules/common/testing-strategy.md](rules/common/testing-strategy.md) for lane selection.

---

## 📚 Key References

| Resource | Purpose |
|:---|:---|
| [agents/agents.overview.md](agents/agents.overview.md) | Which agent to use for what task |
| [skills/skills.overview.md](skills/skills.overview.md) | Discover available skills and how to trigger them |
| [rules/common/orchestration.md](rules/common/orchestration.md) | Task lifecycle, git branching, conflict resolution |
| [rules/common/coding-style.md](rules/common/coding-style.md) | Language-specific standards (Python, TypeScript, C#, DAX) |
| [cheatsheet.md](cheatsheet.md) | Quick command reference |
| [optional_plugins/README.md](optional_plugins/README.md) | Plugin system walkthrough |

---

## 🚢 Phase 11: Plugin System (MVP Complete)

The optional plugin system launched in Phase 11 to optimize bootstrap overhead:

- **13 singleton skills** moved to `optional_plugins/[category]/[skill]/`
- **9 universal core skills** remain in `skills/` (always available)
- **V2 schema** with plugins array and auto-enable per project_type
- **V1→V2 auto-upgrade** (transparent, backward compatible)
- **Token savings**: 15–25% reduction for projects using 1–2 optional plugins

See [Artifacts/ROLLBACK_PROCEDURE.md](Artifacts/ROLLBACK_PROCEDURE.md) for manual reversal if needed.

**Release tag**: `v11.0.0-plugin-system`

---

## 💡 Contributing

To add or update a skill:

1. Follow the [skill-creator](/.claude/skills/skill-creator/) workflow
2. Place in `skills/` (universal) or `optional_plugins/[category]/` (singleton)
3. Ensure SKILL.md has YAML frontmatter with name, description, compatibility
4. Run tests: `pytest tests/` (must pass)
5. Update [skills/skills.overview.md](skills/skills.overview.md) registry
6. Commit with descriptive message

To modify global rules:

1. Edit file in `rules/common/`
2. Update [rules/common/README.md](rules/common/README.md)
3. Commit: `docs(rules): [description]`
4. All active sessions inherit the change (on next `/sync`)

---

## 📞 Support

- **Question about an agent?** → Check [agents/agents.overview.md](agents/agents.overview.md)
- **Need a skill?** → Search [skills/skills.overview.md](skills/skills.overview.md)
- **Unclear rule?** → Read the full file in [rules/common/](rules/common/)
- **Bug or regression?** → Check [Artifacts/learnings/](Artifacts/learnings/) for known issues

---

**Last updated**: July 3, 2026  
**Latest tag**: v11.0.0-plugin-system  
**Status**: Production-ready with plugin MVP
