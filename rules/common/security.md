---
name: security-guidelines
description: Security protocols for secret management, language-specific defenses, MCP tool safety, and incident response.
---

# Security Protocol

## Secret Management

`.env` (gitignored before first commit) for local dev, a vault (Key Vault, 1Password CLI) for
production. Load via env vars at runtime — never hardcode. Rotate immediately if a session was
shared publicly or `/audit` finds an exposure.

## Language-Specific Floor

The floor below is what to enforce explicitly — general secure-coding practice (parameterized
SQL, no `eval`/`pickle` on untrusted input, no client-side secrets, path-traversal rejection) is
assumed baseline, not restated here. Per-language: `rules/lang/{typescript,csharp,dax}.md`.

- **MCP tools**: Zod/Pydantic `inputSchema` mandatory. `[DESTRUCTIVE]` tag + `AskUserQuestion`
  confirmation on any destructive tool. Never pass raw user input to a shell.

## Safety Guards (CRITICAL)

A safety check MUST fail closed: never gate a guard on an optional argument being present —
require it, or default to the safe value and raise when undeterminable. A test-lane bypass must
be explicit and named (`unsafe_skip_check=True`), never the natural consequence of omitting an
argument. Rationale: a guard defaulting to "off" when unsupplied protects the test path only,
silently disabling the shipped capability with no error. HFO-2 case study: `hooks/README.md`.

## MCP & Tool Security

Read-only by default; write access scoped to the project directory. No privilege elevation.
Destructive-command confirmation required for: `rm`, `del`, `git reset --hard`,
`git push --force`, `DROP`, `TRUNCATE`, `chmod`/`chown`.

Incident Response: `agents/auditor.md`.
