# Phase OSH-1: Restore the Hooks Enforcement Layer — Tasks

See `Artifacts/Plans/OSH-1-Plan.md` for technical design. Findings: AUDIT_REPORT.md §1.

> **Coder status (2026-07-07):** all 7 file fixes complete + verified locally (31/31 piped-JSON
> harness green + session-boot 5/5 sections + audit-trail scaffold guard). Evidence:
> `Artifacts/Temp/osh-1_evidence.txt`. **Deferred by user choice:** deploy + live settings
> repoint + live-session smoke test (branch-only for now). **Awaiting auditor** for `[x]`.
> **Deviation flagged:** kept session-boot head-slice (files are newest-first) instead of the
> plan's tail-slice; fixed comments only — auditor to confirm.

## Tasks

- [ ] [coder] Create branch `phase-osh-1-hooks-enforcement` — Success: no work on main
- [ ] [coder] guard-paths.js: hookSpecificOutput deny schema + segment-match fix (HK-C1, HK-M4) — Success: deny JSON validates; `src/secretsauce.py` write allowed, `.env` write denied (evidence files)
- [ ] [coder] guard-commands.js: deny schema + regex fixes: `-f`, `git reset --hard`, fork-bomb parens, rm/rd/del variants, PowerShell patterns (HK-C1, HK-H4, HK-M2, HK-M3, HK-H1) — Success: piped-JSON matrix passes (block/allow per plan §Verification)
- [ ] [coder] session-boot.js: SessionStart wrapper, learnings/index.md path, tail-not-head, CRLF strip, add HANDOFF_BRIEF, drop AGENT_ROLE dead code (HK-C2, HK-H3, HK-L2, HK-I2, HK-I4, HK-I1) — Success: `echo '{}' | node` emits valid hookSpecificOutput with expected sections
- [ ] [coder] auto-lint.js: PostToolUse wrapper, catch label, where/which, execFileSync (HK-C3, HK-L1, HK-L3, HK-L5) — Success: lint report present in hookSpecificOutput on a file with violations
- [ ] [coder] audit-trail.js: 5 MB rotation + no-scaffold-in-foreign-repos guard (HK-M5) — Success: rotation triggers on oversized fixture; no `Artifacts/` created in a bare temp repo
- [ ] [coder] settings-template.json: `Bash|PowerShell` matcher, timeouts in seconds, matcher alignment, paths → `~/.claude/hooks/` (HK-H1, HK-M1, HK-M6, HK-H2) — Success: JSON valid; values match plan
- [ ] [coder] deploy.sh: add `hooks` to copy loop + step-6 validation (HK-H2/TL-H3) — Success: dry-run shows hooks copied; validation counts 6 files
- [ ] [coder] Fail-open regression pass: malformed stdin ×5 scripts — Success: exit 0 all five (evidence)
- [ ] [coder] Update hooks/README.md (deny mechanism, units, deploy step) — Success: no stale claims
- [ ] [coder] File HK-G1..G4 to Artifacts/BACKLOG.md as osh_hooks-gaps_1..4 — Success: 4 entries present
- [ ] [user-approval] Approve edit of live `~/.claude/settings.json` (repoint 5 hook commands) — Success: explicit approval label
- [ ] [coder] Run `bash scripts/deploy.sh`; repoint live settings; live smoke test (trigger one guard, one boot) — Success: deny reason visible in session; boot context injected
- [ ] [auditor] Verify hard rules + evidence; mark phase `[x]` — Success: all metrics green, fail-open intact

## Status

- [x] Strategist approval (Step 0 passed — user accepted audit findings + plan 2026-07-07)
- [x] Git branch created (`phase-osh-1-hooks-enforcement`)
- [x] Implementation complete + local evidence green (coder)
- [ ] Deployed to `~/.claude/` + live settings repointed (deferred — user chose branch-only)
- [ ] Live-session smoke test (next session)
- [ ] Auditor verification complete
