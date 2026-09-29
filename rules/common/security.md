---
name: security-guidelines
description: Security protocols for secret management, language-specific defenses, MCP tool safety, and incident response.
---

# Security Protocol

## Auditor Security Gate

No task is "Done" until: no hardcoded secrets (keys, tokens, connection strings, local paths);
input sanitized at every boundary (Rhino layers, filenames, MCP inputs, DAX params); MCP tools
validate file access scope (no `../` traversal); tracebacks don't leak usernames/IPs/paths; no
deprecated or known-vulnerable dependencies.

## Secret Management

`.env` (gitignored before first commit) for local dev, a vault (Key Vault, 1Password CLI) for
production. Load via env vars at runtime — never hardcode. Rotate immediately if a session was
shared publicly or `/audit` finds an exposure.

## Language-Specific Floor

The floor below is what to enforce explicitly — general secure-coding practice (parameterized
SQL, no `eval`/`pickle` on untrusted input, no client-side secrets, path-traversal rejection) is
assumed baseline, not restated here.

- **MCP tools**: Zod/Pydantic `inputSchema` mandatory. `[DESTRUCTIVE]` tag + `AskUserQuestion`
  confirmation on any destructive tool. Never pass raw user input to a shell.
- **Web frontend**: no secret in `VITE_*`/`import.meta.env` (ships to the browser regardless).
  `dangerouslySetInnerHTML` only behind DOMPurify + a comment. Auth token: httpOnly cookie
  preferred; document the tradeoff if `localStorage`.
- **DAX/Power BI**: RLS on every multi-tenant model. Never embed connection strings in `.pbix`.
  Privacy level explicit, default `Private`. Disable data export on PII/sensitive metrics.
- **C#**: never `BinaryFormatter` — `System.Text.Json`. No dynamic assembly loading from user paths.

## Safety Guards (CRITICAL)

A safety check MUST fail closed: never gate a guard on an optional argument being present —
require it, or default to the safe value and raise when undeterminable. A test-lane bypass must
be explicit and named (`unsafe_skip_check=True`), never the natural consequence of omitting an
argument. Rationale: a guard defaulting to "off" when unsupplied protects the test path only,
silently disabling the shipped capability with no error.

> **Case in point (HFO-2)**: `guard-paths.js` read only *path* fields (`file_path || path || ...`),
> so a content-based rule silently no-oped for `Edit`/`MultiEdit`/`NotebookEdit` — a missing-field
> gap, not a crash. Fixed by making extraction total across every tool shape and logging any
> unrecognised shape (`payload-shape-unknown`) rather than silently passing it — the hook stays
> fail-open (crash/unreadable stdin → exit 0), but nothing is gated on an optional field anymore.
> This licenses no other fail-open guard — residual risk (an unrecognised shape passes once,
> logged) was accepted knowingly; see `DECISION_LOG.md` for full grounds.

## MCP & Tool Security

Read-only by default; write access scoped to the project directory. No privilege elevation.
Destructive-command confirmation required for: `rm`, `del`, `git reset --hard`,
`git push --force`, `DROP`, `TRUNCATE`, `chmod`/`chown`.

## Incident Response

FREEZE (halt coder/scribe, no writes) → AUDIT (full sweep: secrets, vulnerable deps, injection,
leaked system info) → REMEDIATE (rotate keys, patch, purge git history if secrets committed) →
VERIFY (auditor second sweep → `CLEAN`) → RESUME (log in `DECISION_LOG.md`: date, cause, impact,
resolution; update this protocol if it revealed a gap).
