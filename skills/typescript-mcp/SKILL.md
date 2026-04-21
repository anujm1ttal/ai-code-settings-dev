---
name: typescript-mcp
description: MCP specialist focusing on JSON-RPC 2.0, Zod validation, server architecture, async patterns, testing, and operational stability.
tags: ["mcp", "typescript", "api", "json-rpc", "zod", "server-architecture"]
auto_activate: false
argument-hint: "<MCP tool requirement or JSON-RPC question>"
metadata:
  version: "1.0.1"
verbosity_control: "FORMAL. Use interface definitions and error codes as primary communication."
---

# Skill: TypeScript & MCP Development

## Deep-Load Protocol
Load reference files ONLY when the following conditions are met:

| File | Load When |
|:---|:---|
| `references/error-taxonomy.md` | When defining custom error codes or handling complex failures |
| `references/zod-patterns.md` | When constructing complex input schemas or validation logic |


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

## 📡 JSON-RPC 2.0 Compliance

### Handshake
- Validate `initialize` result includes correct `serverInfo` (name, version).
- Verify `capabilities` object declares supported features.
- Reject connections that don't complete the handshake within a configurable timeout.

### Request/Response
- Every request must include `jsonrpc: "2.0"`, `method`, and `id`.
- Responses must include matching `id` and either `result` or `error` — never both.
- Batch requests: Support concurrent processing but respond in order.

### Error Codes
Standard JSON-RPC error codes — use these exclusively:

| Code | Name | When to Use |
| :--- | :--- | :--- |
| `-32700` | Parse Error | Malformed JSON received |
| `-32600` | Invalid Request | Missing `jsonrpc`, `method`, or `id` |
| `-32601` | Method Not Found | Tool name doesn't exist in registry |
| `-32602` | Invalid Params | Zod validation failure on input |
| `-32603` | Internal Error | Unhandled server-side exception |
| `-32000` to `-32099` | Server Error (Custom) | Domain-specific errors (see below) |

### Custom Error Codes (Domain-Specific)

| Code | Name | When to Use |
| :--- | :--- | :--- |
| `-32001` | Geometry Error | Rhino/GH operation failed (tolerance, invalid mesh) |
| `-32002` | Data Error | Power BI / DAX operation failed |
| `-32003` | File Access Error | File not found, permission denied, path traversal blocked |
| `-32004` | Timeout Error | External operation exceeded time limit |
| `-32005` | Validation Error | Business rule validation failed (e.g., C-Value below threshold) |

## 🚦 Error Handling

### Centralized Error Handler
- All errors flow through a single `error-handler.ts` that maps exceptions to JSON-RPC error codes.
- Never throw raw `Error` objects from tool implementations. Use typed error classes.
- Every error response must include:
  - The correct JSON-RPC error code.
  - A human-readable `message`.
  - A `data` object with structured context (tool name, input summary, stack trace in development mode only).

### Error Class Hierarchy

MCPError (base)
├── ValidationError     → -32602
├── GeometryError       → -32001
├── DataError           → -32002
├── FileAccessError     → -32003
├── TimeoutError        → -32004
└── BusinessRuleError   → -32005


### Error Wrapping
- Catch external errors (Rhino bridge, file system, network) and wrap them in the appropriate `MCPError` subclass.
- Preserve the original error via `cause`: `throw new GeometryError("Mesh intersection failed", { cause: originalError })`.
- Never expose internal stack traces in production error responses.

## 🔀 Async Patterns

### Fundamentals
- All tool handlers must be `async`. Even synchronous operations should be wrapped for consistency.
- Use `AbortController` / `AbortSignal` for cancellation support on long-running operations.
- Set explicit timeouts on all external calls (file I/O, bridge operations, network):

const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30_000);


### Concurrency
- Use `Promise.allSettled()` over `Promise.all()` when partial failures are acceptable (e.g., multi-section geometry processing).
- Use `Promise.all()` only when ALL results are required and any failure should abort the batch.
- Never use `Promise.any()` in production — it silently discards errors from losing promises.
- Limit concurrent operations with a semaphore pattern when calling resource-constrained external systems.

### Async Anti-Patterns
- No `async` function without an `await` inside it (useless wrapper).
- No fire-and-forget promises (`someAsyncFn()` without `await` or `.catch()`).
- No `await` inside loops when operations are independent — use `Promise.allSettled()` instead.
- No mixing callbacks and promises in the same flow.

## 🔧 Logging

### Stdout is Sacred
- `stdout` is reserved exclusively for JSON-RPC transport.
- **ALL** debug, info, warning, and error logs must go to `console.error`.
- Any `console.log` in a tool file is a **CRITICAL** bug — it will corrupt the MCP protocol stream.

### Structured Logging
- Use a lightweight logger utility (in `utils/logger.ts`) that wraps `console.error` with structured output:
- Timestamp, level, tool name, message, and optional context object.
- Log levels:
- `DEBUG`: Internal state, request/response payloads (development only).
- `INFO`: Tool invocation start/complete, connection lifecycle events.
- `WARN`: Recoverable issues, fallback behavior triggered.
- `ERROR`: Operation failures, error handler invocations.

### What to Log
- Every tool invocation: tool name, sanitized input summary (no secrets), duration.
- Every error: code, message, tool context, sanitized stack.
- Connection lifecycle: initialize, disconnect, capability negotiation.
- **Never log**: Full request payloads in production, secrets, tokens, PII.

## 🧪 Testing

### Framework
- **Runner**: `vitest` (preferred) or `jest`. Not both.
- **Naming**: `*.test.ts` files co-located with source or in a mirrored `tests/` directory.
- **Convention**: `describe("ToolName")` → `it("should [expected behavior] when [scenario]")`.

### Test Categories

#### Unit Tests (Per Tool)
- Test each tool handler in isolation with mocked dependencies.
- Validate Zod schema acceptance and rejection:
- Valid input → correct result shape.
- Invalid input → `-32602` error with descriptive message.
- Edge cases: empty strings, null values, boundary numbers, oversized payloads.

#### Integration Tests (JSON-RPC Compliance)
- Test the full request → handler → response pipeline.
- Validate correct `id` matching in responses.
- Validate error response format (code, message, data).
- Test batch request handling.

#### Schema Tests
- Every Zod schema gets its own test:
- `.parse()` succeeds on valid input.
- `.parse()` throws on invalid input with a meaningful message.
- `.strict()` rejects unknown properties.

### Mocking
- Mock external bridges (`rhino-bridge.ts`, `powerbi-bridge.ts`) at the service boundary.
- Never mock Zod validation — test it with real schemas.
- Use typed mocks that satisfy the interface contract.

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