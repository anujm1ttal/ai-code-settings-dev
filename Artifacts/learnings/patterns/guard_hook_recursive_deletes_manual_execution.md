# Pattern: Guard Hook — Recursive Deletes & Dangerous Strings Require Manual User Execution

**Category:** patterns  
**First seen:** 2026-07-07 (OSH-1 deployment, OSH-6 cleanup)  
**Operational constraint:** Load-bearing (fail-safe mechanism)

## The behavior

The `guard-commands.js` hook scans the **entire command string** for dangerous syntax patterns:
- `rm -rf`, `rm -r --force` (recursive deletion)
- `git reset --hard`, `git push --force` (destructive git)
- `git clean -f`
- Similar irreversible operations

If a match is found anywhere in the command — even in a grep pattern, a commit message, a test script, or a command that is just *quoting* the syntax — the hook **denies the command** and requires manual user execution outside Claude.

This triggered twice during OSH-6 cleanup when cleanup scripts contained literal recursive-delete patterns for testing.

## Why this is by design

- **Fail-safe**: Prevents accidental data destruction (e.g., a `grep 'rm -rf' /some/file` accidentally running as `rm -rf` if Claude misread the context)
- **User retains control**: Destructive operations require explicit out-of-Claude execution, ensuring human confirmation
- **Not a bug**: This is intentional enforcement, not a regression

## How to work with it

1. If guard blocks a cleanup command: accept the block (it's saving you from a mistake)
2. For legitimate recursive cleanup needed: split the task
   - Run safe operations via Claude (dry-run, listing, preparation)
   - User manually executes the recursive delete in a terminal
3. Do not try to work around the guard by restructuring the command — the entire string is scanned

## Example

```bash
# This will be blocked (even though it's just grep):
grep -n "rm -rf" /some/file

# This will be blocked (commit message with dangerous syntax):
git commit -m "fix: remove old rm -rf code pattern"

# Solution: Run the grep / commit outside Claude, or split the task
```

## Related

Complements **Deploy.sh Rollback Semantics** — both are fail-safe mechanisms protecting against data loss.
