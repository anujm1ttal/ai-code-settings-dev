# ai-code-settings

**Claude Code AI OS** — An orchestration layer for structured, multi-agent AI development workflows.

This repository contains the source code and infrastructure for the AI OS: agent definitions, rules, skills, plugins, and templates. The AI OS powers Claude Code sessions across all your projects through a production deployment at `~/.claude/`.

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

## 👥 For Users

If you're **using Claude Code** to work on a project, this is your reference:

### Quick Start

1. **Create a project**: Copy a template from `~/.claude/templates/` to your project root as `project.json`
   ```bash
   cp ~/.claude/templates/project-code.json my-project/project.json
   ```

2. **Start a session**: Open your project in Claude Code
   - The system auto-loads `~/.claude/` (production deployment)
   - Agent definitions, rules, and skills are automatically available

3. **Use commands**:
   ```
   /blueprint          Plan a new feature or phase
   /triage             Investigate and fix bugs
   /audit              Quality gate validation
   /handoff            Summarize session and save state
   /sweep              Scan codebase for tech debt
   /council            High-rigor deliberation on architecture
   ```

### Reference

- **[cheatsheet.md](cheatsheet.md)** — Quick command reference and navigation
- **[~/.claude/agents/agents.overview.md](~/.claude/agents/agents.overview.md)** — Which agent to use for what task
- **[~/.claude/skills/skills.overview.md](~/.claude/skills/skills.overview.md)** — Available skills and how to trigger them
- **[~/.claude/CLAUDE.md](~/.claude/CLAUDE.md)** — Full orchestration rules loaded at session boot

---

## 👨‍💻 For Developers

If you're **maintaining or improving the AI OS**, this is where you work:

### Repository Structure

This repo is **source/development only**. It's where:
- You edit and test new rules, agents, and skills
- You run the full test suite before deployment
- Development artifacts (tests/, scripts/migrate_*.py) live here

Everything is deployed to `~/.claude/` (production) via `scripts/deploy.sh` for use in actual sessions.

### Quick Start

1. **Navigate the registry**:
   - [agents/agents.overview.md](agents/agents.overview.md) — Agent L1 routing map
   - [skills/skills.overview.md](skills/skills.overview.md) — Skill registry and discovery
   - [rules/common/](rules/common/) — Canonical standards

2. **Update rules**: Edit files in `rules/common/` (changes affect all sessions after deployment)
   - `orchestration.md` — Agent routing, task lifecycle
   - `coding-style.md` — Language-specific standards, immutability rules
   - `standards.md` — Interaction protocol, communication style
   - `security.md` — Secret management, incident response

3. **Create skills**: Use the [skill-creator](/.claude/skills/skill-creator/) to design new domain modules

4. **Run tests**: `pytest tests/` to validate manifest schema and plugin integrity

5. **Deploy to production**: 
   ```bash
   bash scripts/deploy.sh
   ```
   See [DEPLOY.md](DEPLOY.md) for full deployment checklist

### Deployment Architecture

```
ai-code-settings/    ← (you are here — development/source)
  ├─ agents/, rules/, skills/, optional_plugins/
  ├─ scripts/, tests/
  └─ DEPLOY.md, scripts/deploy.sh

~/.claude/           ← (production/runtime)
  ├─ agents/, rules/, skills/, optional_plugins/ (copied from repo)
  ├─ scripts/manifest_validator.py (runtime only)
  └─ templates/, CLAUDE.md (reference)

my-project/          ← (project workspace)
  ├─ project.json (from ~/.claude/templates/)
  └─ Artifacts/ (project state)
```

Sessions auto-load from `~/.claude/` (never from this repo). Deploy via [scripts/deploy.sh](scripts/deploy.sh).

---

## 📁 Directory Structure (This Repository)

```
ai-code-settings/                   (SOURCE/DEVELOPMENT — edit here)
├── README.md                        # This file
├── DEPLOY.md                        # Deployment checklist & rollback procedure
├── cheatsheet.md                    # Quick reference (copied to ~/.claude/)
├── project.json                     # Global manifest (V2 schema)
│
├── agents/                          # Agent definitions (copied to ~/.claude/)
│   ├── agents.overview.md           # L1 routing map
│   ├── strategist.md, coder.md, auditor.md, etc.
│   └── ...
│
├── rules/common/                    # Canonical standards (copied to ~/.claude/)
│   ├── orchestration.md             # Agent lifecycle, task flow
│   ├── coding-style.md              # Language patterns, immutability
│   ├── standards.md                 # Interaction protocol
│   ├── security.md                  # Secrets, incident response
│   ├── testing-strategy.md          # Test lanes, evidence rules
│   ├── architecture.md              # Deep modules, design principles
│   ├── TOKEN-ECONOMICS.md           # Context slicing, bootstrap costs
│   └── README.md                    # Rules overview
│
├── skills/                          # Universal core skills (copied to ~/.claude/)
│   ├── skills.overview.md           # L1 skill discovery map
│   ├── codebase-navigator/
│   ├── systematic-debugging/
│   ├── project-planner/
│   └── ... (9 universal skills, always available)
│
├── optional_plugins/                # Singleton skills (copied to ~/.claude/)
│   ├── index.md, README.md, plugin_manifest_schema.json
│   ├── youtube/, pptx/, pbi-report/, code-mcp/, geometry/, manuscript/
│   └── ... (13 singleton skills, lazy-loaded per project)
│
├── templates/                       # Project templates (copied to ~/.claude/)
│   ├── project-code.json, project-youtube.json, etc.
│   └── ... (bootstraps for new projects)
│
├── scripts/                         # Utilities & automation
│   ├── deploy.sh                    # Deploy to ~/.claude/ (production)
│   ├── manifest_validator.py        # Copied to ~/.claude/ for runtime
│   ├── migrate_skills_to_plugins.py # One-time utility (dev only)
│   └── ... (other dev scripts)
│
├── tests/                           # Test suite (development only)
│   ├── test_manifest_validator_v2.py
│   ├── test_v1_v2_migration.py
│   └── ... (validation before deployment)
│
└── Artifacts/                       # Development state (repo-specific)
    ├── IMPLEMENTATION_PLAN.md       # Development tracking
    ├── TODO.md                      # Current phase tasks
    ├── MEMORY_ANCHORS.md            # Project constants
    ├── learnings/                   # Development learnings
    ├── Plans/                       # Phase-level detailed planning
    ├── Reports/                     # Phase completion reports
    ├── History/                     # Archived phases and decisions
    └── ...
```

**Artifacts Structure:**
- **Root**: High-level overviews (IMPLEMENTATION_PLAN.md, TODO.md) + persistent reference (MEMORY_ANCHORS.md, learnings/)
- **Plans/**: Detailed per-phase planning (Phase-N-Plan.md, Phase-N-TODO.md)
- **Reports/**: Phase completion summaries (Phase-N-Report.md)
- **History/**: Archive for completed phases and decisions (DECISION_LOG.md)

**What gets deployed to ~/.claude/:**
- ✓ agents/, rules/, skills/, optional_plugins/, templates/
- ✓ scripts/manifest_validator.py (runtime dependency)
- ✓ CLAUDE.md, cheatsheet.md, README.md
- ✗ tests/, scripts/migrate_*.py, Artifacts/ (development only)

---

## 🏗️ Architecture: Three Layers

```
┌─────────────────────────────────────┐
│ ai-code-settings (Development)      │  ← You are here (for maintainers)
│ - Source code, tests, development   │
│ - Deploy to ~/.claude/ via DEPLOY.md│
└─────────────────────────────────────┘
            ↓ deploy.sh
┌─────────────────────────────────────┐
│ ~/.claude/ (Production/Runtime)     │  ← Loaded into every session
│ - Immutable deployment              │
│ - Rules, agents, skills, plugins    │
│ - manifest_validator.py (runtime)   │
└─────────────────────────────────────┘
            ↓ auto-load
┌─────────────────────────────────────┐
│ my-project/ (Project Workspace)     │  ← Where users work
│ - project.json (manifest)           │
│ - Artifacts/ (project state)        │
│ - Inherits everything from ~/.claude/
└─────────────────────────────────────┘
```

**Sessions load from `~/.claude/`** (production), never from this repo (source). This ensures development artifacts never leak into active work.

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

1. **Universal Core Skills** (always in `~/.claude/skills/`)
   - Available to all project types
   - Examples: codebase-navigator, systematic-debugging, project-planner
   - Source: [skills/](skills/) in this repo

2. **Optional Singleton Skills** (lazy-loaded from `~/.claude/optional_plugins/`)
   - Project-type-specific (youtube, pptx, geometry, etc.)
   - Auto-enabled if `auto_include: true` in manifest
   - Can be disabled per project
   - Source: [optional_plugins/](optional_plugins/) in this repo

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

## 🔧 Common Workflows (Users)

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

## 🔨 Developer Workflows

### Update a Global Rule

1. Edit file in `rules/common/` (e.g., `rules/common/coding-style.md`)
2. Test locally: `pytest tests/ -v`
3. Deploy: `bash scripts/deploy.sh`
4. New sessions inherit the change (via `~/.claude/`)

### Add a New Skill

1. Use [skill-creator](/.claude/skills/skill-creator/) workflow
2. Place in `skills/` (universal) or `optional_plugins/[category]/` (singleton)
3. Update [skills/skills.overview.md](skills/skills.overview.md) registry
4. Run tests: `pytest tests/` (must pass)
5. Deploy: `bash scripts/deploy.sh`

### Deploy Changes

```bash
# Full deployment with validation
bash scripts/deploy.sh

# Skip tests (not recommended)
bash scripts/deploy.sh --skip-tests

# See DEPLOY.md for detailed checklist
```

---

## 🛡️ Security

All secrets managed via environment variables or secure vaults:
- **Local dev**: `.env` (git-ignored)
- **Production**: Azure Key Vault, 1Password CLI, or equivalent
- **Never commit**: API keys, tokens, connection strings, local paths

See [rules/common/security.md](rules/common/security.md) for incident response procedures (source: this repo, deployed to `~/.claude/`).

---

## 📊 Testing & Validation (Developers)

All changes to the AI OS validated via test suite before deployment:

```bash
# Run all tests (required before deploy)
pytest tests/ -v

# Run specific test class
pytest tests/test_manifest_validator_v2.py::TestPluginRegistry -v

# Check manifest validation
python scripts/manifest_validator.py --list-plugins
```

**Test lanes**:
- **Lane B (Pure)**: No Rhino/external runtime (fastest, default)
- **Lane A (Headless)**: RhinoCommon via Rhino.Inside
- **Lane A (Full)**: Full Rhino UI environment

See [rules/common/testing-strategy.md](rules/common/testing-strategy.md) for lane selection.

---

## 📚 Key References

### For Users

| Resource | Purpose | Location |
|:---|:---|:---|
| [cheatsheet.md](cheatsheet.md) | Quick command reference | This repo (also `~/.claude/`) |
| [~/.claude/agents/agents.overview.md](~/.claude/agents/agents.overview.md) | Which agent to use | Production deployment |
| [~/.claude/skills/skills.overview.md](~/.claude/skills/skills.overview.md) | Available skills | Production deployment |
| [~/.claude/CLAUDE.md](~/.claude/CLAUDE.md) | Full orchestration rules | Production deployment |

### For Developers

| Resource | Purpose | Location |
|:---|:---|:---|
| [DEPLOY.md](DEPLOY.md) | Deployment checklist & automation | This repo |
| [agents/agents.overview.md](agents/agents.overview.md) | Agent definitions (source) | This repo |
| [rules/common/orchestration.md](rules/common/orchestration.md) | Orchestration rules (source) | This repo |
| [rules/common/coding-style.md](rules/common/coding-style.md) | Coding standards (source) | This repo |
| [skills/skills.overview.md](skills/skills.overview.md) | Skill registry (source) | This repo |
| [optional_plugins/README.md](optional_plugins/README.md) | Plugin system design | This repo |

---

## 🚢 Phase 11: Plugin System (MVP Complete)

The optional plugin system launched in Phase 11 to optimize bootstrap overhead:

- **13 singleton skills** in `optional_plugins/[category]/[skill]/`
- **9 universal core skills** in `skills/` (always available)
- **V2 schema** with plugins array and auto-enable per project_type
- **V1→V2 auto-upgrade** (transparent, backward compatible)
- **Token savings**: 15–25% reduction for projects using 1–2 optional plugins

**Release tag**: `v11.0.0-plugin-system`

---

## 💡 Contributing (Developers)

### Add or Update a Skill

1. Follow the [skill-creator](/.claude/skills/skill-creator/) workflow
2. Place in `skills/` (universal) or `optional_plugins/[category]/` (singleton)
3. Ensure SKILL.md has YAML frontmatter with name, description, compatibility
4. Run tests: `pytest tests/` (must pass)
5. Update [skills/skills.overview.md](skills/skills.overview.md) registry
6. Deploy: `bash scripts/deploy.sh`

### Modify Global Rules

1. Edit file in `rules/common/`
2. Update [rules/common/README.md](rules/common/README.md)
3. Run tests: `pytest tests/ -v`
4. Deploy: `bash scripts/deploy.sh`
5. All active sessions inherit change after next `/sync`

---

## 📞 Support

**Users**:
- **Quick reference?** → See [cheatsheet.md](cheatsheet.md)
- **How do I use an agent?** → Check `~/.claude/agents/agents.overview.md`
- **Which skill for my task?** → Search `~/.claude/skills/skills.overview.md`

**Developers**:
- **How do I deploy?** → See [DEPLOY.md](DEPLOY.md)
- **How do I add a skill?** → Use [skill-creator](/.claude/skills/skill-creator/) workflow
- **Deployment failed?** → Check rollback in [DEPLOY.md](DEPLOY.md)
- **Tests are failing?** → Run `pytest tests/ -v` from this repo

---

**Last updated**: July 3, 2026  
**Latest tag**: v11.0.0-plugin-system  
**Status**: Production-ready with plugin MVP + deployment infrastructure
