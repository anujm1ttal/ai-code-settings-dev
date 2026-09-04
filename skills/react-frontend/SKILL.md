---
name: react-frontend
description: Use this skill when writing, refactoring, or reviewing React + TypeScript frontend code for Vite client-side SPAs. It fixes the OS's project-invariant frontend choices — hooks discipline, component architecture, state/data layering, styling, form validation, and the accessibility floor. Trigger on any .tsx/.jsx work, a new Vite React app, a failing react-hooks or jsx-a11y lint, or adding TanStack Query / Zustand / react-hook-form. Do NOT use for MCP-server TypeScript (refer to typescript-mcp) or React Server Components / Next.js (out of scope — this skill is client SPA only).
argument-hint: "<React/TypeScript UI requirement or frontend architecture question>"
metadata:
  version: "1.0.0"
  tags: ["react", "typescript", "frontend", "web-ui", "coding-style"]
  globs: ["*.tsx", "*.jsx", "vite.config.*", "vitest.config.*"]
  verbosity_control: "TECHNICAL. High-density bullets. Every line is a project-invariant choice, not a tutorial."
---


# Skill: React Frontend Patterns

**Scope**: Vite + React 18 + React Router, client-side SPA, TypeScript `strict`. Every bullet
encodes a choice between ≥2 defensible options — if it is what any React dev does by default,
it is not in here. Immutability, error handling, and constants rules inherit from `coding-style.md`.

## 1. Hooks discipline
- Rules of Hooks are absolute: no hooks in a conditional, loop, or after an early return. When a branch needs different hooks, split it into its own component — never a ref-and-flag workaround.
- `react-hooks/exhaustive-deps` is `error`, not the default `warn`. A silenced dep is a stale-closure bug: fix the dep array or restructure; an `eslint-disable` on it needs a reviewed comment justifying why the closure is intentionally frozen.
- Custom hooks return referentially stable values — wrap exported functions/objects in `useCallback`/`useMemo` so consumers can pass them straight into dep arrays without re-run churn.
- Effects synchronise with external systems only (DOM, subscriptions, imperative APIs). State derived from other state/props is computed in render; a `useEffect` that `setState`s from render data is a bug, not a pattern.
- Reach for `useReducer` once two or more state fields change together — not a `useState` per field.

## 2. Component architecture
- One component per file, file named for the component. No barrel `index.ts` re-export files — they defeat tree-shaking and hide the real import path.
- ≤150 lines per component; past that, extract a subcomponent or a hook. Deliberately tighter than the 800-line file cap — JSX plus handlers plus logic hits comprehension limits earlier than plain code.
- Colocate `Button.tsx`, `Button.test.tsx`, `Button.module.css` in one folder — not scattered across `/components`, `/tests`, `/styles` type-trees.
- Props typed with `interface`, not `type`; never `React.FC` — it forces implicit `children`, breaks generic components, and buys nothing.
- Container/presentational split only where the `architecture.md` deletion test shows a real seam. Do not pre-split every component.

## 3. State & data
- Local `useState` first. Lift state only when two components genuinely share it now — not preemptively.
- Server state goes through **TanStack Query**, not a hand-rolled cache or `useEffect`. Loading / error / empty are explicit rendered branches, never `data === undefined` checks sprinkled through JSX.
- **Zustand** for genuinely global client state (auth session, theme, cross-route UI). Not Redux (boilerplate tax), not Context-as-store (re-renders every consumer on any change).
- No `useEffect` + `fetch` for data loading — that pattern loses caching, dedup, retry, refetch-on-focus, and races on unmount.
- URL / router params are the store for shareable UI state (filters, active tab, pagination) — not component state.

## 4. Styling
- **CSS Modules** by default: build-time scoping, zero runtime, no CSS-in-JS bundle cost.
- Tailwind is a per-repo opt-in, allowed only when that project's `CLAUDE.md` declares it — its class-string ergonomics are genuinely contested, so it is never the silent default.
- No inline `style={{}}` for static styling — it can't be themed, cached, or media-queried. Inline style is only for values computed at runtime (measured sizes, dynamic transforms).
- Design tokens are CSS custom properties (`--color-*`, `--space-*`), not a TS constants object — theming then works without a React re-render and CSS consumes them directly.

## 5. Forms & boundary validation
- One **Zod** schema per form, and it is the single source of truth: the TS type comes from `z.infer`, the runtime check from the same schema.
- **react-hook-form** for form state (uncontrolled inputs, minimal re-renders) over a controlled `useState` per field or Formik.
- Client validation is a UX affordance only. Re-validate the same schema at every server boundary — client validation is never a security control (`security.md`).
- Server-side submit errors map back onto the offending fields via `setError`, not a detached toast — keep the correction next to the input.

## 6. Accessibility floor
- Semantic HTML before ARIA: `<button>`, `<nav>`, `<label>`. An ARIA role is the fallback when no native element fits, not a first move.
- Every interactive element is keyboard-reachable and shows a visible focus indicator — no `outline: none` without a replacement `:focus-visible` style.
- Labels are programmatically associated with inputs (`htmlFor`/`id` or wrapping). Placeholder text is not a label.
- `eslint-plugin-jsx-a11y` `recommended` runs at `error`, not `warn` — a11y regressions block CI like type errors do.
- Respect `prefers-reduced-motion`: gate non-essential animation behind the media query.
- Contrast ≥ 4.5:1 body text / ≥ 3:1 large text — the same floor as `visual-composition`.

## Preferred toolchain
- **Build**: Vite. **Runtime**: React 18+. **Language**: TypeScript, `strict: true`.
- **Test**: Vitest + `@testing-library/react` + jsdom for unit/component; **Playwright** for E2E; **MSW** to mock the network at the transport layer, not via module mocks.
- **Lint**: `eslint` with `@typescript-eslint`, `react-hooks`, `jsx-a11y`. **Format**: `prettier` for formatting only — no formatting rules in eslint.
- **Libraries**: React Router (client SPA) · TanStack Query (server state) · Zustand (global client state) · react-hook-form + Zod (forms).

## Deny list
- No `any` — use `unknown` and narrow.
- No `React.FC`.
- No `useEffect` for derived state — compute it in render.
- No data fetching inside `useEffect` — use TanStack Query.
- No `dangerouslySetInnerHTML` without a sanitiser (DOMPurify) and a comment naming the source of the HTML.
- No secrets in client code — `VITE_*` / `import.meta.env` values ship to the browser in plaintext.
- No default exports — named exports only (cleaner renames, consistent import names, better auto-import).
- No prop-drilling past 2 levels — compose with `children`, or reach for context / store.

## Framework-specific (Vite + React Router — minority section)
- Route-level code-splitting via `React.lazy` + `<Suspense>` at the router boundary, not per leaf component.
- API calls in dev go through the Vite dev-server proxy — do not hardcode `http://localhost:PORT` in fetch calls or rely on CORS.
- Env branching uses `import.meta.env.MODE`; only `VITE_`-prefixed vars are exposed, and every one is public by definition.
