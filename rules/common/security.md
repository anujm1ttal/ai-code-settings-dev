---
name: security-guidelines
description: Security protocols for secret management, language-specific defenses, MCP tool safety, and incident response.
---

# Security Protocol

## Auditor Security Gate

No task is "Done" until:
- [ ] No hardcoded secrets (API keys, tokens, connection strings, local paths)
- [ ] Input sanitization on all user-provided strings (Rhino layers, filenames, MCP inputs, DAX params)
- [ ] MCP tools validate file access scope (no `../` traversal)
- [ ] Tracebacks don't leak usernames, IPs, or directory structures
- [ ] No deprecated or known-vulnerable dependencies

## Secret Management

- **Storage**: `.env` for local dev. Secure vault (Azure Key Vault, 1Password CLI) for production.
- **Never commit**: `.env*` must be in `.gitignore` before first commit.
- **Access**: Load via environment variables at runtime.
  - Python: `os.environ["KEY"]` or Pydantic `BaseSettings`
  - TypeScript: `process.env.KEY` with Zod validation
  - C#: `IConfiguration` + User Secrets (local) / Key Vault (prod)
- **Rotation**: Rotate immediately if session shared publicly or `/audit` detects exposure.

## Language-Specific Security

### Python
- **Forbidden**: `eval()`, `exec()`, `pickle.loads()`, `yaml.load()` on untrusted input (use `yaml.safe_load()`)
- **Auth**: `secrets.token_urlsafe()` over `random`
- **SQL**: Parameterized queries only. No f-string/`.format()` query construction.
- **Deps**: Pin versions in `pyproject.toml`. Audit with `pip-audit` or `uv`.
- **File I/O**: Reject paths containing `..`, `~`, or unexpected absolute paths.

### TypeScript / MCP
- **Zod mandatory** on all `inputSchema`. No raw `JSON.parse()`.
- **Shell safety**: Never pass raw user input to Shell. Zod-validate and escape first.
- **Destructive tools**: Must include `[DESTRUCTIVE]` warning + `AskUserQuestion` confirmation.
- **Deps**: Pin in `package-lock.json`. Audit with `npm audit`.

### C#
- **NuGet**: Pin versions. No floating ranges. Audit for vulnerabilities.
- **Assembly trust**: Only load from verified sources. No dynamic loading from user paths.
- **Serialization**: Never `BinaryFormatter`. Use `System.Text.Json`.
- **File paths**: Reject `..` traversal and paths outside project directory.

### DAX / Power BI
- **RLS**: Implement on all multi-tenant/multi-user models.
- **Connection strings**: Never embed in `.pbix`. Use Power BI parameters.
- **Privacy levels**: Set explicitly. Default `Private`.
- **Exports**: Disable underlying data export for PII/sensitive metrics.

## Safety Guards (CRITICAL)

A safety check MUST fail closed:
- Never gate a guard on an optional argument being present — require it, or default it to the safe value and raise when it cannot be determined.
- If a test lane needs to bypass a guard, the bypass must be explicit and named (e.g., an `unsafe_skip_check=True` flag), never the natural consequence of omitting an argument.
- Rationale: A guard defaulting to "off" when not explicitly supplied protects the test path and nothing else for the entire life of the feature, silently disabling shipped capabilities with no error.

## MCP & Tool Security

- **Read-only by default**. Write access scoped to project directory only.
- **No elevation**: Tools must not request system privileges.
- **Destructive command confirmation** required for: `rm`, `del`, `git reset --hard`, `git push --force`, `DROP`, `TRUNCATE`, `chmod`/`chown`.

## Incident Response

1. **FREEZE**: Halt all coder/scribe agents. No file writes.
2. **AUDIT**: Full codebase sweep — secrets, vulnerable deps, injection vectors, leaked system info.
3. **REMEDIATE**: Rotate keys, update `.gitignore`, patch vulnerability. Purge git history if secrets were committed.
4. **VERIFY**: Auditor second sweep → `CLEAN` status.
5. **RESUME**: Log incident in `Artifacts/DECISION_LOG.md` (date, cause, impact, resolution). Update this protocol if gap revealed.