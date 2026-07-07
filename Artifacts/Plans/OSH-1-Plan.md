# Phase OSH-1: Restore the Hooks Enforcement Layer

**Initiative:** OSH — OS Hardening · **Findings:** `Artifacts/AUDIT_REPORT.md` §1 (HK-*)
**Branch:** `phase-osh-1-hooks-enforcement` · **Owner:** coder → auditor
**Mode:** Standard workflow (not high-rigor), but every hook fix requires runtime evidence (see Verification).

## Objectives

The hooks layer is the OS's only hard guardrail and it is largely non-functional: all three
feedback channels emit schemas the harness drops (HK-C1..C3), the command guard misses the
primary shell (HK-H1), and hooks bypass the deploy gate entirely (HK-H2). This phase makes
every hook actually do what `CLAUDE-global.md`'s Hooks table claims, and brings hooks under
the deploy discipline.

## Technical Approach

**Output-schema repair (the critical fix).** Per the Claude Code hooks API:
- PreToolUse deny = EITHER stderr + exit 2, OR stdout JSON
  `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"..."}}` + exit 0.
  **Decision: use the JSON `hookSpecificOutput` form (exit 0)** for both guards — it is the
  documented structured channel and carries the reason to Claude reliably.
- SessionStart / PostToolUse context injection = stdout JSON
  `{"hookSpecificOutput":{"hookEventName":"<Event>","additionalContext":"..."}}` + exit 0.

**Deploy integration.** Add `hooks` to deploy.sh's copy loop and validation step; repoint all
five hook commands in `~/.claude/settings.json` AND `hooks/settings-template.json` to
`~/.claude/hooks/*.js` (use `$CLAUDE_CONFIG_DIR`-relative or `~`-expanded absolute path,
forward slashes). After this phase, editing `hooks/` in the repo is no longer live-instantly.

**Scope boundary.** Fixes only — no new hook types. The four coverage gaps (HK-G1..G4:
Stop/PreCompact hooks, scratch-gate, commit-trailer guard) are new features → filed in
`Artifacts/BACKLOG.md` for a separate Step 0.

## File Changes

| File | Edit | Findings |
|:---|:---|:---|
| `hooks/guard-paths.js` | Replace stdout-JSON+exit(2) block (~:92-98) with `hookSpecificOutput.permissionDecision: "deny"` + `permissionDecisionReason` + exit 0. Fix substring false positives: require full segment match (`/${segment}/` or end-of-path) instead of bare `/${segment}` prefix (:54); scope `bin`/`obj` blocking to compiled-output contexts, not any `bin/` dir (:61-64). | HK-C1, HK-M4 |
| `hooks/guard-commands.js` | Same deny-schema replacement (~:60-67). Pattern fixes: add `-f\b` alternative to force-push regex (keep `--force-with-lease` carve-out) (:21); add `git reset --hard` pattern; escape fork-bomb parens `:\(\)\{ :\|:& \};:` (:30); extend rm-guard for drive roots (`[A-Za-z]:[\\/]`), root-glob, `rd /s /q`, `del /q /s` any flag order (:13-16); add PowerShell-native patterns: `Remove-Item ... -Recurse ... -Force` (any order), `Format-Volume`, `Clear-Disk`. | HK-C1, HK-H4, HK-M2, HK-M3, HK-H1 |
| `hooks/session-boot.js` | Wrap output in `hookSpecificOutput.hookEventName:"SessionStart".additionalContext` (:128-133). Read `Artifacts/learnings/index.md` with fallback to legacy `LEARNINGS.md` (:59). Change head-slice to tail-slice (`lines.slice(-maxLines)`) and fix the "last N" comments (:15-25 vs :52,58,64). Strip `\r` after split (:19). Add `Artifacts/HANDOFF_BRIEF.md` to the boot read-set (cap lines like the others). Delete dead `AGENT_ROLE` branch (:107). | HK-C2, HK-H3, HK-L2, HK-I2, HK-I4, HK-I1 |
| `hooks/auto-lint.js` | Wrap report in `hookSpecificOutput.hookEventName:"PostToolUse".additionalContext` (:107-117). Fix catch label `audit-trail` → `auto-lint` (:123). Platform-aware `where`/`which` (:45). Use `execFileSync(cmd, [file])` instead of shell-interpolated string (:19,:34). | HK-C3, HK-L1, HK-L3, HK-L5 |
| `hooks/audit-trail.js` | Size-based rotation: if `audit_trail.jsonl` > 5 MB, rename to `audit_trail.<ISO-date>.jsonl` before append (:60). Only create `Artifacts/.agent/` when `Artifacts/` already exists in the project root — never scaffold Artifacts into foreign repos (:49-51). | HK-M5 |
| `hooks/settings-template.json` | guard-commands matcher `"Bash"` → `"Bash\|PowerShell"` (:27). All `timeout` values converted to seconds: `5000/3000/20000` → `5/3/20` (:10,23,33,44,54). Align audit-trail matcher with chosen canonical (`"*"`). Repoint all 5 `command` paths from the repo working copy to `~/.claude/hooks/*.js`. | HK-H1, HK-M1, HK-M6, HK-H2 |
| `scripts/deploy.sh` | Add `hooks` to the copy loop (:125 region) and to step-6 validation (5 .js files + settings-template.json exist in dest). | HK-H2 / TL-H3 |
| `~/.claude/settings.json` | Repoint the 5 hook commands to `~/.claude/hooks/*.js` (matches updated template). **[user-approval]** — live production config edit. | HK-H2, HK-M6 |
| `hooks/README.md` | Update: deny mechanism (hookSpecificOutput), timeout units, deploy step, PowerShell coverage. | doc sync |
| `Artifacts/BACKLOG.md` | File HK-G1..G4 as `osh_hooks-gaps_1..4` (Stop/SubagentStop /handoff nudge; PreCompact 60%-context enforcement; scratch-dir hard-gate; commit-trailer guard). | HK-G1..G4 |

## Dependencies

**Prerequisites:** none — runs first (highest leverage; other phases assume guards work).
**Enablements:** trustworthy CLAUDE-global Hooks table; deploy discipline covers hooks (OSH-6 deploy work builds on this).

## Verification (Evidence Required)

Lane B equivalent for JS — pipe synthetic hook JSON through each script and assert output/exit:

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"git push -f origin main"}}' | node hooks/guard-commands.js
# expect: exit 0, stdout hookSpecificOutput.permissionDecision == "deny"
echo '{"tool_name":"PowerShell","tool_input":{"command":"Remove-Item -Recurse -Force C:/x"}}' | node hooks/guard-commands.js
echo '{"tool_name":"Write","tool_input":{"file_path":"src/secretsauce.py"}}' | node hooks/guard-paths.js
# expect: ALLOW (false-positive fixed)
echo '{}' | node hooks/session-boot.js   # expect: valid hookSpecificOutput JSON, no throw
echo 'not json' | node hooks/guard-commands.js && echo FAIL-OPEN-OK   # expect exit 0
```

Save outputs to `Artifacts/Temp/osh-1_<step>_<hook>.txt`. Then one live-session smoke test after deploy: trigger a guard and confirm Claude receives the deny reason.

## Hard Rules (Auditor Rejects on Violation)

1. Every hook remains **fail-open**: malformed stdin, missing files, or internal errors exit 0. Re-verify per script after edits.
2. **No new hook events or features** in this phase — fixes to the existing five only; gaps go to BACKLOG.
3. No behavioral claim without piped-JSON runtime evidence (Inspection-as-verification forbidden).
4. `~/.claude/settings.json` is not edited until the deployed `~/.claude/hooks/` copies exist and pass the smoke tests (no window where settings point at nothing).

## Success Metrics

- [ ] All 5 hooks emit documented-schema output (evidence files in Artifacts/Temp/)
- [ ] Guard deny-reason visible to Claude in a live session test
- [ ] PowerShell dangerous-command test blocked; `git push -f` blocked; `--force-with-lease` allowed
- [ ] `bash scripts/deploy.sh` copies hooks + validates; live settings point at `~/.claude/hooks/`
- [ ] session-boot injects TODO + learnings/index.md + HANDOFF_BRIEF (verified in a fresh session)
- [ ] Fail-open re-verified for all 5 scripts; auditor PASS
