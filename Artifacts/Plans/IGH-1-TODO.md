# IGH-1 — Phase TODO

**Plan:** `Artifacts/Plans/IGH-1-Plan.md` · **Branch:** `phase-igh-1-mechanical-guards`
**Step 0:** approved 2026-07-26 · **Grill:** [REFACTORED] 2026-07-26

Status: `[ ]` not started · `[-]` in progress (coder) · `[x]` auditor-verified complete

---

- [ ] [auditor] T1: Geometry-plugin activation check — determine whether RDT-1's `-r` rule and the `sc.doc` pitfall are live in the INSTALLED geometry plugin, not just present in repo source — Success: factual table per rule (live / dormant) with command + raw output cited; if dormant, the remedy named is reinstall, not authoring — Mode: AFK

- [ ] [coder] T2: Source-redirect guard in `hooks/guard-commands.js` — deny `>`/`>>`/heredoc redirect into tracked source extensions; allowlist `Artifacts/Temp/`, `Artifacts/Evidence/`, `/tmp`, scratch, `/dev/null`; do not touch heredocs that redirect nowhere (`git commit -m @'…'@`) — Success: deny fires on source redirect; **allowlist tests prove Temp/ and Evidence/ redirection still passes (HR1)**; deny message names Write/Edit as the alternative — Mode: AFK — Blocked by: T1

- [ ] [coder] T3: Shared-state Stop hook `hooks/guard-shared-state.js` — grep turn diff for `sys.stdout`/`sys.stderr`/`logging.`/`TextIOWrapper`/`reconfigure`/`os.environ`; nag if touched and no full-suite run this turn; feedback-only, never blocks — Success: fires on subset-only run after a shared-state edit; silent on full-suite run; exits 0 on malformed input — Mode: AFK — Blocked by: T2

- [ ] [coder] T4: Register + document — add `guard-shared-state.js` to `hooks/enforced-rules.json`; document both guards in `hooks/README.md`; file the T3 exit-condition entry in `Artifacts/BACKLOG.md` (`**Status:** OPEN`, `Exit: trigger:20-session telemetry review — delete if zero fires`) — Success: `deploy.sh` reports **8** enforced hooks wired; `backlog_audit.py` exit 0 — Mode: AFK — Blocked by: T3

- [ ] [auditor] T5: Phase gate — verify M1–M8 and all 3 Hard Rules against raw artifacts; write `Artifacts/Reports/IGH-1-Report.md` — Success: auditor PASS; `pytest tests/ -q` exit 0; `deploy.sh` 6/6 — Mode: HITL — Blocked by: T4

---

## Hard Rules (auditor rejects on violation)

1. The redirect guard must not block the EVD evidence protocol — allowlist tests for
   `Artifacts/Temp/` and `Artifacts/Evidence/` are mandatory, not optional.
2. All hooks fail open (script error → exit 0). T3 is feedback-only and never blocks a turn.
3. No rule authored before T1 answers — a dormant rule is an activation problem, not an
   authoring problem.

## Irreversible actions (stop-and-surface — user approval required)

- `bash scripts/deploy.sh` — overwrites `~/.claude/`
- `git commit` / `git push` / merge to `main`

## Carried into IGH-2 (do not start here)

Read-back rule (`testing-strategy.md`); call-site sweep as **one line** in `coding-style.md`
§Surgical Precision; scope discipline (`standards.md`); auditor blindness (one clause in
`implementation-dispatch/reviewer-prompt.md`) **gated on live-fire dispatch evidence**.
