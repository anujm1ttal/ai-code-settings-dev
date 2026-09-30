---
name: typescript-rules
description: TypeScript/React implementation and security floor. Loads only when a .ts/.tsx/.jsx file is touched.
paths: ["**/*.ts", "**/*.tsx", "**/*.jsx", "**/tsconfig*.json"]
---

# TypeScript / React

## Language-Specific

- **TypeScript**: strict (`noImplicitAny`, `strictNullChecks`), `unknown` over `any`, Zod at
  every boundary. MCP: JSON-RPC error codes, `console.error` for debug (`stdout` is the
  transport). React/web: CSS Modules by default, TanStack Query (never fetch in `useEffect`),
  Vitest+RTL+jsdom, `eslint-plugin-jsx-a11y` = error. Full references: `typescript-mcp`,
  `react-frontend`.

## Security Floor

- **Web frontend**: no secret in `VITE_*`/`import.meta.env` (ships to the browser regardless).
  `dangerouslySetInnerHTML` only behind DOMPurify + a comment. Auth token: httpOnly cookie
  preferred; document the tradeoff if `localStorage`.

## LSP

`typescript-lsp` (Claude Code plugin) is a bare `typescript-language-server` PATH lookup —
no-ops silently if not installed (`hfo1_lsp-os-docs_1`).
