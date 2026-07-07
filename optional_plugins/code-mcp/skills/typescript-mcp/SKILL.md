---
name: typescript-mcp
description: Use this skill when building, debugging, or reviewing Model Context Protocol (MCP) servers in TypeScript. It enforces JSON-RPC 2.0 compliance, Zod-based schema validation, and strict error handling patterns. Trigger when creating a new MCP tool, fixing a JSON-RPC communication error, or updating a Zod input schema. Do NOT use for general TypeScript frontend development or backend work that does not implement the MCP standard.
argument-hint: "<MCP tool requirement or JSON-RPC question>"
model: claude-sonnet-5
metadata:
  version: "1.0.1"
  tags: ["mcp", "typescript", "api", "json-rpc", "zod", "server-architecture"]
  verbosity_control: "FORMAL. Use interface definitions and error codes as primary communication."
---

# Skill: TypeScript & MCP Development

## Deep-Load Protocol
Load reference files ONLY when the following conditions are met:

| File | Load When |
|:---|:---|
| `references/json-rpc.md` | Mandatory for any communication or protocol task |
| `references/error-taxonomy.md` | When defining custom error codes or handling complex failures |
| `references/zod-patterns.md` | When constructing complex input schemas or validation logic |
| `references/async-patterns.md` | When optimizing concurrency or handling long-running tools |
| `references/testing-standards.md` | Before writing tests or setting up CI/CD |
| `references/naming-standards.md` | When creating new files or renaming members |


## 🏗 Project Structure

### Directory Layout

src/
├── tools/
│   ├── index.ts            # Tool registry — exports all tools
│   ├── sightline-tool.ts   # One tool per file
│   ├── seating-tool.ts
│   └── sync-tool.ts
├── schemas/
│   ├── index.ts            # Schema registry
│   ├── sightline.schema.ts # Zod schemas per tool
│   └── seating.schema.ts
├── handlers/
│   ├── request-handler.ts  # JSON-RPC request routing
│   └── error-handler.ts    # Centralized error mapping
├── services/
│   ├── rhino-bridge.ts     # External system integrations
│   └── powerbi-bridge.ts
├── utils/
│   ├── logger.ts           # Logging configuration
│   ├── constants.ts        # All domain constants
│   └── validation.ts       # Shared validation helpers
├── types/
│   └── index.ts            # Shared type definitions
└── server.ts               # Entry point — MCP server bootstrap


### File Rules
- **One tool per file**: Each MCP tool lives in its own file in `tools/`.
- **Matched schemas**: Every tool file has a corresponding schema file in `schemas/`.
- **Density**: Files should stay under 400 lines. Extract shared logic to `utils/` or `services/`.
- **Barrel exports**: Use `index.ts` barrel files for clean imports. No deep path imports from outside the module.

## 🛡 Safety & Validation

### Zod (Mandatory)
- Every `inputSchema` definition must use a Zod schema. No raw `JSON.parse()` without validation.
- Define schemas in dedicated files (`schemas/*.schema.ts`), not inline in tool definitions.
- Use `.describe()` on every Zod field to auto-generate tool descriptions.
- Use `.strict()` on object schemas to reject unknown properties.

### Strictness
- `tsconfig.json` must include:
  - `"strict": true`
  - `"noImplicitAny": true`
  - `"strictNullChecks": true`
  - `"noUncheckedIndexedAccess": true`
  - `"noUnusedLocals": true`
  - `"noUnusedParameters": true`
- Use `interface` for all tool payloads and response shapes. Prefer `interface` over `type` for object shapes (better error messages, extendable).
- Use `as const` for literal tuples and enums.

### Destructive Tool Tagging
- Tools that write files, execute shell commands, or modify external systems must:
  - Include `[DESTRUCTIVE]` in the tool description.
  - Require explicit user confirmation via `AskUserQuestion` before execution.
  - Log the action to `.agent/shell_log.md` with timestamp and parameters.

## 📡 JSON-RPC & Async
Consult [json-rpc.md](references/json-rpc.md) and [async-patterns.md](references/async-patterns.md) for protocol and performance standards.

## 🚦 Error Handling
Consult [error-taxonomy.md](references/error-taxonomy.md) for custom error codes and mapping standards.

## 🧪 Testing & Naming
Consult [testing-standards.md](references/testing-standards.md) and [naming-standards.md](references/naming-standards.md) for quality gates and architectural consistency.

## 🚫 Anti-Patterns (Explicit Deny List)
- No `any` type. Use `unknown` and narrow with type guards or Zod.
- No `console.log` in tool files — it corrupts `stdout`.
- No raw `JSON.parse()` without Zod validation.
- No `require()` — use ES modules (`import`/`export`).
- No default exports — use named exports for discoverability.
- No `enum` (use `as const` objects for better tree-shaking and type inference).
- No `!` non-null assertion — handle the `null`/`undefined` case explicitly.
- No `@ts-ignore` without a specific error code comment explaining why.
- No callback-style async — promises only.
- No `var` — use `const` by default, `let` only when reassignment is required.

## 🔨 Preferred Toolchain
- **Runtime**: Node.js 20+ (LTS).
- **Package Manager**: `pnpm` (preferred) or `npm`. Not `yarn`.
- **Testing**: `vitest` (preferred) or `jest`.
- **Linting**: `eslint` with `@typescript-eslint` plugin.
- **Formatting**: `prettier`.
- **Bundling**: `tsup` or `esbuild` for production builds.
- **Type Checking**: `tsc --noEmit` in CI. `tsconfig.json` strict mode.