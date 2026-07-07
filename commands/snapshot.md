---
description: Generates a structured, exhaustive, and purely factual Markdown report of the codebase for external review or auditing.
argument-hint: "[scope]"
allowed-tools: Read, Grep, Glob
model: claude-sonnet-5
---

# Command: /snapshot

**Target**: `$ARGUMENTS` → optional `[scope]` to narrow the report.

Owned by the **auditor**. The "Black Box" flight recorder — extracts raw technical state without analysis or prose padding.

## Section Logic

Follow these sections exactly. Use Grep (content search) and Glob (directory listing) for data extraction.

### 1. Project Metadata
- Name, version, last updated
- Python version, key dependencies (from requirements/pyproject)
- Entry points (server + client)
- How it's run (commands)

### 2. Directory Structure
Full tree of core modules (max depth 8). 
- Provide a 1-line purpose for each top-level directory.
- Include file sizes (bytes) and line counts next to each file.

### 3. File Inventory Table
Markdown table: `Path | Lines | Purpose (1 line) | Key exports`

### 4. Interface & API Surface
List all public entry points (REST endpoints, MCP tools, CLI commands, or exported public classes/functions).
- Name, parameters/signatures (with types), 1-line description, file:line where defined.
- For networked apps: Flag any mismatch between client-side calls and server-side exposure.

### 5. Templates & Configurable Assets
Extract all static templates, system prompts, SQL queries, or configuration-heavy files (e.g., in `prompts/`, `templates/`, or `queries/` folders).
- Filename, Full verbatim text (truncated if >100 lines), Invocation point (file:line).

### 6. Domain DSL & Logic Patterns
Extract locations where domain-specific logic, naming conventions, or mini-DSLs are defined or parsed (e.g., Layer naming systems, specialized regex patterns, or custom schema parsers).
- File:line + verbatim snippet.
- Inferred grammar/format and examples from the codebase.

### 7. Security Gates
- Whitelists, Traceback limiting code, Port config/env vars.
- Client-side: timeout, reconnect, and validation code snippets.

### 8. Configuration & Environment
- All env vars read (name, default, where used).
- Config files and their schemas.

### 9. Logging
- Logger setup code, log file locations, rotation settings.
- Sample of recent log output (last ~50 lines if available).

### 10. TODO / FIXME / HACK / XXX
Grep the repo. Table: `File:Line | Tag | Comment`

### 11. Dependencies Between Modules
Adjacency list of internal module imports.

### 12. Tests
- List test files, run command, and coverage summary.

### 13. Known Pain Points (Facts Only)
- Files > 500 lines.
- Functions > 50 lines.
- Classes > 15 methods.
- Duplicate function/method names across files.

### 14. Git State
- Current branch, last 20 commits.
- `git status --short`.
- Count and locations of domain-specific binary files (e.g., `.gh`, `.3dm`).

### 15. Open Questions
List specific ambiguities discovered during extraction that the codebase cannot resolve.

## Rules

- **Facts Only**: No opinions, no recommendations, no "consider refactoring".
- **Verbatim**: Quote code snippets exactly.
- **Exhaustive**: If a section is N/A, write "None found".
- **References**: Use `file:line` for every code mention.
- **Compact**: Truncate long files (>100 lines) with `... [truncated, N more lines]` and note full line count.
- **Single Output**: Produce one single Markdown document.
