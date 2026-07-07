---
name: doc-updater
description: Use this skill whenever you are generating, updating, or auditing project documentation for staleness, formatting, or technical accuracy. It defines the standards for READMEs, architecture docs (Artifacts/ARCH.md), and stakeholder-facing guides. Trigger when source code changes require documentation updates, when a new module is added, or when the scribe is performing a /docs audit. Do NOT use for brainstorming or initial research notes unless they are being formalized into the project's permanent documentation library.
argument-hint: "[--staleness-scan|--reference <symbol>]"
model: claude-haiku-4-5
metadata:
  version: "1.0.1"
  tags: ["documentation", "maintenance", "knowledge-management", "writing", "scribe"]
  verbosity_control: "TELEGRAPHIC. Documentation about documentation must itself be concise. No irony."
---


# Skill: Documentation Standards & Maintenance

## 📐 Core Principles

### Documentation is a Deliverable
- Documentation is not an afterthought — it is a gated requirement in the `auditor`'s Plan Exit Review.
- A task cannot be marked `[x]` if its related documentation is stale or missing.
- The `scribe` is responsible for all documentation. The `coder` is responsible for flagging when documentation needs updating.

### Density Over Length
- Every sentence must carry information. If a paragraph can be a bullet point, make it a bullet point.
- If a bullet point can be a table row, make it a table row.
- No LLM filler: "In this section, we will discuss..." — just discuss it.
- No conversational padding: "It's important to note that..." — just state the note.

### Audience-Aware
- Always know who is reading. A developer README and a stadium ops Quick Start are fundamentally different documents.
- When in doubt, optimize for the least technical reader who will use the document.

## 📋 Document Templates

### README.md

Required sections in order:

- **# Project Name**: One-line description.
- **## Overview**: 2–3 sentences on what this project does and why it exists. Reference the Step 0 VALUE_CHECK.
- **## Quick Start**: The fastest path from zero to "it works." Numbered steps. Copy-pasteable commands.
- **## Prerequisites**: All dependencies, tools, versions, and environment requirements. Use a table.
- **## Installation**: Step-by-step setup. Include environment variables with example values (not real secrets).
- **## Usage**: Primary use cases with examples. Code blocks for CLI commands or function calls.
- **## Architecture**: Brief overview or link to `Artifacts/ARCH.md` for details.
- **## Limitations**: What this project CANNOT do. Be explicit — this prevents support burden.
- **## Contributing**: How to add to this project. Reference coding-style.md and testing requirements.

### Artifacts/ARCH.md

Required sections in order:

- **# Architecture: [Project Name]**
- **## System Overview**: ASCII diagram of major components and their relationships.
- **## Component Map**: Table listing each module/service, its purpose, its primary file(s), and its owner agent.
- **## Data Flow**: ASCII diagram showing how data moves through the system (input → processing → output).
- **## Key Decisions**: Summary table of architectural decisions with links to `Artifacts/DECISION_LOG.md` entries.
- **## Constraints**: Technical limitations, platform requirements, performance boundaries.
- **## Dependencies**: External systems, APIs, data sources, and their availability/reliability.

### Quick Start Guide (Stakeholder-Facing)

Required sections in order:

- **# [Tool Name] — Quick Start**
- **## What This Does**: One paragraph, no jargon. What problem does it solve for the user?
- **## What You Need**: Prerequisites in plain language. "You need Rhino 7 installed" not "Requires RhinoCommon SDK 7.x."
- **## Step-by-Step**: Numbered instructions with screenshots or ASCII mockups where helpful. Each step is one action.
- **## Expected Output**: What does success look like? Include sample output or screenshot description.
- **## Troubleshooting**: Top 3 most likely issues and their fixes.
- **## What This Cannot Do**: Explicit limitations to set correct expectations.
- **## Getting Help**: Who to contact or where to file issues.

### API / MCP Tool Documentation

Required fields per tool:

| Field | Description |
| :--- | :--- |
| **Tool Name** | `kebab-case` name as registered in MCP |
| **Description** | One sentence — what does this tool do? |
| **Input Schema** | Full Zod schema with field descriptions |
| **Required Fields** | List of mandatory input fields |
| **Optional Fields** | List of optional fields with defaults |
| **Output Schema** | Structure of the success response |
| **Error Codes** | JSON-RPC error codes this tool may return |
| **Example Request** | Valid JSON-RPC request |
| **Example Response** | Corresponding success response |
| **Destructive** | Yes / No — does this tool modify state? |

### DAX Measure Catalog

Required fields per measure:

| Field | Description |
| :--- | :--- |
| **Measure Name** | Display name in the Power BI model |
| **Purpose** | One sentence — what business question does this answer? |
| **Display Folder** | Where this measure lives in the field list |
| **Dependencies** | Tables and columns referenced |
| **Formula** | Full DAX expression |
| **Example Output** | Sample result with filter context described |
| **Performance Notes** | Iterator usage, expected row count, known limitations |

## 🔄 Staleness Detection

### What Triggers Staleness
A document is **stale** when any of these conditions are true:

| Trigger | Affected Documents |
| :--- | :--- |
| Source code file modified | README.md, Artifacts/ARCH.md, API docs for that module |
| New module or tool added | README.md (architecture section), Artifacts/ARCH.md (component map) |
| Dependency added or removed | README.md (prerequisites), Artifacts/ARCH.md (dependencies) |
| Architecture decision made | Artifacts/ARCH.md (key decisions), link to Artifacts/DECISION_LOG.md |
| Success metric changed | Artifacts/IMPLEMENTATION_PLAN.md phase description |
| MCP tool schema changed | API/tool documentation for that tool |
| DAX measure modified | Measure catalog entry |
| ASCII diagram's source code changed | The diagram itself |

### Staleness Severity

| Severity | Condition | Impact |
| :--- | :--- | :--- |
| **CRITICAL** | API/tool docs don't match actual schema | Users will get errors following the docs |
| **HIGH** | README Quick Start is broken (wrong commands/steps) | New users can't onboard |
| **HIGH** | Artifacts/ARCH.md doesn't reflect current structure | Developers make wrong assumptions |
| **MEDIUM** | Measure catalog missing new measures | Discoverability issue |
| **LOW** | Minor formatting or typo in non-critical docs | Cosmetic only |

### Staleness Scan Protocol
Run by the `scribe` during `/docs` (auto-detect mode):

1. **File Timestamps**: Compare doc last-modified against source last-modified.
2. **Content Grep**: Search docs for references to renamed or deleted files, functions, or tools.
3. **Schema Diff**: For MCP tools, compare documented `inputSchema` against actual Zod schema in code.
4. **Measure Diff**: For DAX, compare documented formulas against actual `.dax` files.
5. **Diagram Check**: For each ASCII diagram, check if the code it represents has been modified.

## ✏️ Update Protocol

### When to Update Immediately (Same Session)
- API/tool schema changes — documentation must match code before `auditor` approval.
- ASCII diagrams adjacent to modified code.
- README Quick Start steps that are now incorrect.

### When to Update Next Session
- New modules added but not yet audited (document after audit pass).
- Artifacts/ARCH.md structural changes from a Re-Plan (document after new plan is stable).
- Measure catalog additions (document after DAX measures pass audit).

### When to Flag for Strategist
- Documentation reveals architectural inconsistencies (the doc is correct but the code is wrong — or vice versa).
- A Tier 2 (user-facing) document needs domain knowledge the `scribe` doesn't have.
- Documentation scope exceeds the current phase — new docs may need to be planned as a task.

## 🖋 Formatting Standards

### Universal Rules
- **Headers**: Use `##` for major sections, `###` for subsections. No deeper than `####`.
- **Bold**: For key terms, file names, agent names, and critical warnings.
- **Code**: Inline backticks for file names, function names, commands, and config values.
- **Tables**: For any comparison, registry, or structured reference data.
- **Bullets**: For lists, requirements, and sequential-but-unnumbered items.
- **Numbered Lists**: Only for sequential steps where order matters (setup, workflow).
- **Links**: Internal links to other project docs where relevant. No broken links.

### ASCII Diagrams
- Use box-drawing characters for clean diagrams:
  - `┌ ─ ┐ │ └ ┘ ├ ┤ ┬ ┴ ┼` for boxes and lines.
  - `→ ← ↑ ↓` for directional flow.
- Label every box and arrow.
- Include a one-line caption above the diagram explaining what it shows.
- Maximum width: 80 characters (terminal-friendly).

### What NOT to Write
- "This document describes..." — the title already does that.
- "Please note that..." — just state the note.
- "In order to..." — just say "To..."
- "It should be noted..." — note it directly.
- "As mentioned above..." — if they need to scroll up, restructure.
- "Various" / "Several" / "Many" — use a specific number or list them.

## 📋 Documentation Checklist

Run by the `scribe` before submitting docs to the `auditor`:

- [ ] All template sections present for the document type?
- [ ] No LLM filler or conversational padding?
- [ ] All code examples are copy-pasteable and tested?
- [ ] All file references point to files that exist?
- [ ] All ASCII diagrams match the current code?
- [ ] Limitations section is present and honest?
- [ ] Tables used for structured data instead of prose lists?
- [ ] Headers create a scannable table of contents?
- [ ] No broken internal links?
- [ ] Audience-appropriate language (Tier 1 vs Tier 2 vs Tier 3)?