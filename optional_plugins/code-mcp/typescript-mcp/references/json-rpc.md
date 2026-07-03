# Reference: JSON-RPC 2.0 Compliance for MCP

This document defines the strict protocol standards for JSON-RPC 2.0 communication in MCP servers.

## 📡 Protocol Standards

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
| `-32000` to `-32099` | Server Error (Custom) | Domain-specific errors (see [error-taxonomy.md](error-taxonomy.md)) |
