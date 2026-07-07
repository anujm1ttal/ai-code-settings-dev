---
name: python-mcp
description: "Expert in building, debugging, and reviewing Model Context Protocol (MCP) servers using Python. This skill enforces the use of FastMCP and Pydantic v2 for high-performance, type-safe agent tool orchestration. Use this skill whenever you are designing a new MCP server, adding tools to an existing one, or troubleshooting JSON-RPC communication issues in a Python environment. Trigger when the user mentions 'Python MCP', 'FastMCP', or asks to 'build a tool' for a specific API. Do NOT use this skill for general Python development without an MCP component or for TypeScript-based MCP servers."
metadata:
  version: "1.0.0"
  tags: [mcp, python, fastmcp, pydantic, api, integration]
---

# Skill: Python MCP

Strategic and tactical standards for building high-rigor Model Context Protocol (MCP) servers in Python.

## Evaluation Test Cases

This skill has formal evaluation test cases for quality assurance. See `evals.json` for:
- Building complete FastMCP servers with Pydantic v2 validation
- Adding new tools to existing servers
- Debugging and fixing JSON-RPC schema issues

These cases verify proper FastMCP patterns, schema validation, and error handling.

---

## 🧠 Core Strategy

Building an MCP server is a two-phase process. Do not skip Phase 1.

### Phase 1: Discovery & Planning
Before writing code, you must map the target API and design the tool surface.
> [!TIP]
> Deep-load the [Planning Checklist](./references/planning-checklist.md) for naming conventions and tool selection criteria.

### Phase 2: Implementation (FastMCP)
We mandate the use of `mcp.server.fastmcp.FastMCP` for automatic schema generation and Pydantic v2 for input validation.
> [!TIP]
> Deep-load the [FastMCP Implementation Patterns](./references/fastmcp-patterns.md) for code snippets, error handling, and response formatting.

## 🛠 Strategic Workflow

1.  **Analyze API**: Identify endpoints, auth, and data models.
2.  **Select Tools**: Prioritize tools that enable complete workflows (e.g., `github_create_and_link_pr`) over simple wrappers.
3.  **Define Schemas**: Use Pydantic models with clear descriptions and constraints.
4.  **Implement Utilities**: Centralize API clients and error handling.
5.  **Build Tools**: Use `@mcp.tool` with explicit annotations.

## 🚦 Verification Gate

No Python MCP server is ready until it passes the following checks:

### 1. CLI Integrity
- Run `python main.py --help` (or equivalent).
- Verify all imports resolve and the server starts without errors.

### 2. Schema Quality
- All `Field` definitions have descriptive `description` strings.
- Constraints (`min_length`, `ge`, etc.) are applied to all sensitive inputs.

### 3. Response Efficiency
- Human-readable outputs use Markdown (headers, lists).
- Machine-readable outputs use structured JSON.

## 🔗 Relationships
- **Consumes**: `python-patterns` (PEP 8, types).
- **Complements**: `typescript-mcp` (for cross-language comparison).
- **Audited by**: `auditor` (via `/audit`).
