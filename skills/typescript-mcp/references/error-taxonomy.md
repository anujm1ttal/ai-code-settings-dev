# MCP Error Taxonomy & Resolution

> Load this on-demand when troubleshooting JSON-RPC failures or bridge communication errors.

## 📡 Standard JSON-RPC Error Codes

| Code | Name | Root Cause | Resolution Path |
| :--- | :--- | :--- | :--- |
| `-32700` | Parse Error | Malformed JSON received | Check payload serialization and character encoding. |
| `-32600` | Invalid Request | Missing `jsonrpc`, `method`, or `id` | Validate the client's request wrapper structure. |
| `-32601` | Method Not Found | Tool name doesn't exist | Check `tools/index.ts` registry exports. |
| `-32602` | Invalid Params | Zod validation failure | Check `schemas/` against the input data. |
| `-32603` | Internal Error | Unhandled exception | Check server logs (`console.error` logs). |

## 🛠 Domain-Specific Custom Errors

| Code | Name | Cause | Fix |
| :--- | :--- | :--- | :--- |
| `-32001` | Geometry Error | Rhino/GH bridge failed | check tolerance, check naked edges. |
| `-32002` | Data Error | Power BI / DAX failed | check relationship Star Schema integrity. |
| `-32003` | File Access Error | OS Permission / Path miss | Use absolute paths and verify permissions. |
| `-32004` | Timeout Error | Bridge took >30s | Optimize query or increase specific tool timeout. |
| `-32005` | Validation Error | Business rule violation | Reject input and suggest within-bounds values. |

## 🚦 Error Handling Pattern

Every tool implementation MUST use the base `MCPError` class to ensure consistent response formatting.

```typescript
try {
  const result = await rhinoBridge.intersect(brepA, brepB);
} catch (error) {
  throw new GeometryError("Intersection failed", { cause: error });
}
```
