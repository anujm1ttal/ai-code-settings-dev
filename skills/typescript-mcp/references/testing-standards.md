# Reference: Testing Standards for TypeScript MCP

This document defines the quality gates and testing protocols for MCP tool development.

## 🧪 Testing Protocol

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
