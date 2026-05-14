# Reference: Naming Conventions for TypeScript MCP

This document defines the strict naming standards for files, code members, and MCP tools.

## 📝 Naming Conventions

### Files
- `kebab-case` for all file names: `sightline-tool.ts`, `seating.schema.ts`.
- Suffix conventions: `.tool.ts`, `.schema.ts`, `.test.ts`, `.service.ts`.

### Code
- `PascalCase`: Interfaces, types, classes, enums.
- `camelCase`: Variables, functions, methods, parameters.
- `UPPER_SNAKE`: Constants and enum values.
- `I` prefix forbidden on interfaces (no `ISightlineTool` — just `SightlineTool`).

### Tool Names
- `kebab-case` for MCP tool names: `calculate-sightlines`, `export-seating-data`.
- Tool names must be descriptive and action-oriented: verb-noun pattern.
