---
name: security-guidelines
description: Mandatory security protocols for local file access, MCP tool execution, secret management, and language-specific defenses across Python, TypeScript, C#, and DAX.
---

# Security Protocol: Antigravity Defense

## 🛡️ The Auditor's Security Gate
The **auditor** agent is the final gatekeeper. No task is "Done" until these checks pass:
- [ ] **No Hardcoded Secrets**: Scour for API keys, tokens, connection strings, or local file paths in code or prose.
- [ ] **Input Sanitization**: All user-provided strings (especially in Rhino layers, filenames, MCP inputs, and DAX parameters) must be validated and escaped.
- [ ] **Boundary Validation**: MCP tools must strictly validate the scope of file access (no `../` path traversal).
- [ ] **Fail-Safe Errors**: Tracebacks do not leak local system usernames, internal network IPs, or directory structures.
- [ ] **Dependency Hygiene**: No deprecated, abandoned, or known-vulnerable packages in the dependency tree.

## 🔑 Secret & Environment Management

### Storage
- **Persistence**: Use `.env` files for local development. Use a secure vault (e.g., Azure Key Vault, 1Password CLI) for production.
- **Never Commit**: `.env`, `.env.local`, and any file containing secrets must be in `.gitignore` before the first commit.
- **Bootstrapping**: The `strategist` must include a "Secret Check" in Phase 1 of every project plan.

### Rotation
- If a session is shared or logged to a public cloud, immediately rotate all associated project keys.
- If `/audit` detects an exposed secret, trigger the Incident Response Protocol (below).

### Access Patterns
- Load secrets via environment variables at runtime. Never import from a config file that could be committed.
- Python: `os.environ["KEY"]` or Pydantic `BaseSettings` with `.env` file support.
- TypeScript: `process.env.KEY` with Zod validation on startup.
- C#: `IConfiguration` with User Secrets for local dev, Key Vault for production.

## 🗣️ Language-Specific Security

### Python
- **Forbidden**: `eval()`, `exec()`, `pickle.loads()`, `yaml.load()` (use `yaml.safe_load()`) on untrusted input.
- **Auth**: Use `secrets.token_urlsafe()` over `random` for anything authentication-related.
- **SQL**: Parameterized queries only. No f-string or `.format()` query construction.
- **Dependencies**: Pin all versions in `pyproject.toml`. Audit with `pip-audit` or `uv` before releases.
- **File I/O**: Validate and sanitize all file paths. Reject paths containing `..`, `~`, or absolute paths when relative is expected.

### TypeScript / MCP
- **Zod Mandatory**: All MCP tool `inputSchema` definitions must use Zod validation. No raw `JSON.parse()` without schema verification.
- **Shell Safety**: Never pass raw user input to `Shell` commands. All parameters must be Zod-validated and escaped before execution.
- **Stdout Integrity**: Use `console.error` for debug/operational logs. `stdout` is reserved for JSON-RPC transport — corruption here breaks the MCP protocol.
- **Destructive Tools**: Any tool that writes files, deletes resources, or executes shell commands must:
  - Include a `[DESTRUCTIVE]` warning in its tool description.
  - Require explicit user confirmation via `AskUserQuestion` before execution.
- **Dependencies**: Pin versions in `package-lock.json`. Audit with `npm audit` before releases.

### C# / Grasshopper
- **NuGet Hygiene**: Pin all package versions. No floating version ranges (`*` or `>=`). Audit for deprecated or vulnerable packages before builds.
- **Assembly Trust**: Only load Grasshopper plugin assemblies from trusted, verified sources. Never dynamically load assemblies from user-provided paths.
- **Input Validation**: Validate all GH component input parameters at entry. Reject null geometry, empty lists, and out-of-range values before processing.
- **Disposal**: Implement `IDisposable` on all classes holding unmanaged resources. Use `using` statements. Failure to dispose geometry objects in large loops is a **CRITICAL** security and stability issue.
- **Serialization**: Never use `BinaryFormatter`. Use `System.Text.Json` with explicit type handling.
- **File Paths**: Validate all paths from GH file-picker components. Reject `..` traversal and absolute paths outside the project directory.

### DAX / Power BI
- **Row-Level Security (RLS)**: Implement RLS roles on all models exposed to multi-tenant or multi-user scenarios.
- **Connection Strings**: Never embed connection strings in `.pbix` files. Use Power BI parameters with environment-specific values.
- **Data Source Privacy**: Set privacy levels explicitly for all data sources. Default to `Private` unless cross-source queries are required and approved.
- **Export Controls**: Disable underlying data export in published reports when the data contains PII or sensitive operational metrics.

## 🛰️ MCP & Tool Security

Since agents can execute code, follow the **Principle of Least Privilege**:

### Access Control
- **Read-Only by Default**: Tools should only have `Write` access to the specific project directory.
- **Scoped Permissions**: MCP tools must declare their file system scope. No tool should access paths outside its declared boundary.
- **No Elevation**: Tools must not request or assume elevated system privileges.

### Destructive Command Protection
Any command matching these patterns requires explicit `AskUserQuestion` confirmation:
- File deletion: `rm`, `del`, `unlink`, `shutil.rmtree`
- Git destructive: `git reset --hard`, `git clean -fd`, `git push --force`
- System modification: `chmod`, `chown`, environment variable writes
- Database writes: `DROP`, `TRUNCATE`, `DELETE FROM`

### Shell Execution Rules
- All shell commands must be constructed from validated, escaped parameters.
- No string interpolation in shell commands. Use argument arrays where possible.
- Log all shell executions to `.agent/shell_log.md` with timestamp, command, and outcome.

## 🚨 Incident Response Protocol

If a vulnerability or exposed secret is detected:

### 1. FREEZE
- Halt all active `coder` and `scribe` agents immediately.
- No further file writes until the incident is resolved.

### 2. AUDIT
- Invoke the `auditor` with the `security` tag.
- Full codebase sweep for:
  - Exposed secrets (API keys, tokens, passwords, connection strings).
  - Vulnerable dependencies.
  - Path traversal or injection vectors.
  - Leaked system information in error messages or logs.

### 3. REMEDIATE
- Rotate all potentially compromised keys and tokens.
- Update `.gitignore` to prevent future exposure.
- Patch the vulnerability or remove the offending code.
- If secrets were committed to git history: `git filter-branch` or `BFG Repo-Cleaner` to purge.

### 4. VERIFY
- Auditor performs a second sweep to confirm the fix.
- Run `/sync` to ensure state files reflect the remediation.

### 5. RESUME
- Only once the auditor provides a `CLEAN` status.
- Log the incident in `DECISION_LOG.md` with date, cause, impact, and resolution.
- Update security practices if the incident revealed a gap in this protocol.