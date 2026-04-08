# Claude Code Sample Prompts

This guide demonstrates how to trigger the different agents and workflows in Claude Code using your custom slash commands.

## Getting Started & Planning

When starting a session on a new or existing project, the system automatically runs the concierge boot sequence. Keep your plans organized with the `strategist` using `/blueprint`.

### Starting a New Project
```prompt
/blueprint We need to build a new Python CLI tool for exporting data to CSV. It needs to read from a local SQLite database.
```

### Adding a New Phase
When the current `Artifacts/IMPLEMENTATION_PLAN.md` is complete, append the next phase:
```prompt
/blueprint We finished the CLI. Let's add a new phase to build a web dashboard for the exported data.
```

### Pivoting / Restarting
If a technical approach failed and you need to rewrite the plan:
```prompt
/blueprint We need to pivot. The SQLite approach is too slow; we are moving to PostgreSQL. Please archive the old plan and let's start over.
```

### Codebase Discovery & Tech Debt
To map out a new codebase, find redundancies, or plan a refactor for technical debt:
```prompt
/sweep
```
*(The strategist will scan the repository and identify areas for improvement or architectural drift)*

## Daily Workflow

### 1. Doing the Work
You can work with the `coder` agent normally without slash commands for standard implementation tasks:
```prompt
Please implement the database connection module as outlined in Phase 1 of the Artifacts/IMPLEMENTATION_PLAN.md.
```

#### Systematic Debugging (When stuck or fixing a bug)
If you encounter a bug or a test failure, trigger the 4-phase debugging process:
```prompt
I'm seeing a NilReferenceException in the logger. Use the systematic-debugging skill to find the root cause.
```

#### Subagent Dispatch (For complex/large tasks)
When a task touches many files or the context is getting full, offload it to a subagent:
```prompt
This refactor is complex. Use the implementation-dispatch skill to delegate the API updates to a subagent.
```

### 2. Auditing (The Gatekeeper)
When you finish a task, or when you are stuck or want a code review, call the auditor. It will generate an `Artifacts/AUDIT_REPORT.md` and append any missing tasks to `Artifacts/TODO.md`.
```prompt
/audit
```

**Pre-Implementation Audit:**
If you want the auditor to review a plan *before* the coder starts writing code to ensure it meets requirements:
```prompt
/audit --pre
```

### 3. Syncing State
If you've been coding manually (outside of Claude) or feel the `Artifacts/TODO.md` is out of date:
```prompt
/sync
```

If you made changes in external GUI tools (like Power BI or Rhino) and want to explain them to the AI so it updates its project state:
```prompt
/ingest I manually updated the Star Schema in Power BI. The Date table is now connected to the Sales fact table.
```

### 4. Learning
When Claude makes a mistake or you establish a new preference, save it to the persistent memory so it doesn't happen again:
```prompt
/learn mistake: You used `logging` instead of `loguru`. Remember that all Python logging must use `loguru`.
```

### 5. Documenting
When a feature is done and you need to update docs, use the `scribe` via `/docs`. 

**Auto-detect stale docs and missing coverage:**
```prompt
/docs
```

**Target specific documentation tiers:**
```prompt
/docs --internal
```
*(Updates README, Artifacts/ARCH.md, and developer documentation)*

```prompt
/docs --user
```
*(Updates user-facing guides, Quick Starts)*

```prompt
/docs --reference
```
*(Updates API endpoints, schemas, DAX definitions)*

**Target specific files:**
```prompt
/docs update the main README.md to include the new database configuration variables.
```

### 6. Ending the Day
When you are done working, compress the context and write a handoff brief for your next session:
```prompt
/handoff
```

### 7. Verifying Hooks (Claude Code only)
To see your active security guardrails, path guards, and auto-linters:
```prompt
/hooks
```

---

## Exploring / Learning a Codebase (Explain Mode)

When you enter an unfamiliar repository or want to understand how a specific module works without modifying it, use the `scribe` in **Explain mode**.

**High-level project orientation:**
```prompt
/explain
```
*(Provides a 10-second summary, module map, and lists entry points)*

**Targeted explanation:**
```prompt
/explain the authentication flow in the backend API
```

**Tracing a specific user journey:**
```prompt
/explain --flow "user submits the checkout form"
```
*(Shows the step-by-step call chain with `file:line` references)*

**Understanding design decisions:**
```prompt
/explain --why we are using context managers instead of manual locks in the database module
```
*(Explains the rationale, tradeoffs, and rejected alternatives for a design choice)*

**Locating symbols:**
```prompt
/explain --find "calculate_tax_rate"
```
*(Locates where exactly a symbol is defined and everywhere it is used)*

---

## Specialized Project Workflows

### YouTube Pipeline
For YouTube content creation projects:

```prompt
/ideate We're doing a video about why Python list comprehensions are better than for-loops.
```
*(After Artifacts/VIDEO_PLAN.md is approved by you)*
```prompt
/script
```
*(After Artifacts/SCRIPT.md is finished)*
```prompt
/pack
```

### PowerPoint Decks
For scaffolding a new presentation:
```prompt
/deck We need a Q3 All-Hands presentation. Standard corporate template. First phase is an outline.
```

### Manuscripts / Writing
To trigger the developmental editor audit on your raw text:
```prompt
/audit Please review chapter 3 focusing on character agency and pacing.
```
