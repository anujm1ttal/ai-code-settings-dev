# Execution Rule: Deploy.sh Rollback Uses Scoped-Item Replace, Never Full-Wipe

**Category:** execution-rule  
**Filed:** 2026-07-08 (OSH-6 deploy script remediation)  
**Operational constraint:** Load-bearing (data safety)

## Rule

The `deploy.sh` rollback mechanism uses **scoped-item backup and restore**, not a full-wipe strategy.

When `bash scripts/deploy.sh --rollback` is invoked:
1. A backup was created during deploy at `~/.claude.backup-YYYYMMDD-HHMMSS`
2. Rollback restores **per-item** from that backup:
   - `rules/common/` → restored from backup
   - `skills/` → restored from backup
   - `commands/` → restored from backup
   - `hooks/` → restored from backup
   - `settings.json` → restored from backup
3. Untracked state (e.g., `plugins/`, `projects/`, user-added custom keys in settings.json) is **preserved** (not wiped)

## Why this matters

The pre-OSH-6 semantics were **destructive**: rollback would wipe the entire `~/.claude/` directory and restore from backup, destroying any extended state the user added after the backup was created (new plugins installed, custom project settings, custom hooks, etc.).

The current scoped-item semantics are **safe**: a rollback only restores the OS registry layers (rules/skills/commands/hooks), leaving user extensions intact.

## Example scenario

```
User actions:
1. Deploy happens → backup created at ~/.claude.backup-20260708-000656
2. User installs a custom plugin → ~/.claude/plugins/my-custom-plugin/
3. Deploy goes wrong → deploy.sh --rollback runs

Result (scoped semantics — correct):
- Rules/skills/commands/hooks restored from backup
- ~/.claude/plugins/my-custom-plugin/ preserved
- User's custom settings preserved

Result (full-wipe semantics — wrong, prevented by this rule):
- Entire ~/.claude/ wiped and replaced from backup
- User's plugin and settings lost
```

## How to use

Before deploying to production, understand that rollback is safe for extended repos. Do not assume "rollback = full reset". The scoping is intentional and critical.

If you need to test rollback: verify that untracked files (plugins/, projects/) are still present after `--rollback` completes.

## Related

Complements **Guard Hook** pattern — both are fail-safe mechanisms. Also informed by OSH-1 deployment flow (hooks must remain fail-open) and OSH-6 tooling remediation (deploy.sh must be auditable and safe).
