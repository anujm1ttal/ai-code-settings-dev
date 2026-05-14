# Reference: Async Patterns in TypeScript MCP

This document defines the mandatory asynchronous programming patterns for high-performance MCP servers.

## 🔀 Async Standards

### Fundamentals
- All tool handlers must be `async`. Even synchronous operations should be wrapped for consistency.
- Use `AbortController` / `AbortSignal` for cancellation support on long-running operations.
- Set explicit timeouts on all external calls (file I/O, bridge operations, network).

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30_000);
```

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
