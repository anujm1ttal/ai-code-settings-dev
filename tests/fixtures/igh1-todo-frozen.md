# IGH-1 — Phase TODO

**Plan:** `Artifacts/Plans/IGH-1-Plan.md` · **Branch:** `phase-igh-1-mechanical-guards`
**Step 0:** approved 2026-07-26 · **Grill:** [REFACTORED] 2026-07-26

Status: `[ ]` not started · `[-]` in progress (coder) · `[x]` auditor-verified complete

---

- [x] [auditor] T1: Geometry-plugin activation check — determine whether RDT-1's `-r` rule and the `sc.doc` pitfall are live in the INSTALLED geometry plugin, not just present in repo source — Success: factual table per rule (live / dormant) with command + raw output cited; if dormant, the remedy named is reinstall, not authoring — Mode: AFK

- [x] [coder] T2: Source-redirect guard in `hooks/guard-commands.js` — deny `>`/`>>`/heredoc redirect into tracked source extensions; allowlist `Artifacts/Temp/`, `Artifacts/Evidence/`, `/tmp`, scratch, `/dev/null`; do not touch heredocs that redirect nowhere (`git commit -m @'…'@`) — Success: deny fires on source redirect; **allowlist tests prove Temp/ and Evidence/ redirection still passes (HR1)**; deny message names Write/Edit as the alternative — Mode: AFK — Blocked by: T1

- [x] [coder] T3: Shared-state Stop hook `hooks/guard-shared-state.js` — grep turn diff for `sys.stdout`/`sys.stderr`/`logging.`/`TextIOWrapper`/`reconfigure`/`os.environ`; nag if touched and no full-suite run this turn; feedback-only, never blocks — Success: fires on subset-only run after a shared-state edit; silent on full-suite run; exits 0 on malformed input — Mode: AFK — Blocked by: T2

- [x] [coder] T4: Register + document — add `guard-shared-state.js` to `hooks/enforced-rules.json`; document both guards in `hooks/README.md`; file the T3 exit-condition entry in `Artifacts/BACKLOG.md` (`**Status:** OPEN`, `Exit: trigger:20-session telemetry review — delete if zero fires`) — Success: `deploy.sh` reports **8** enforced hooks wired; `backlog_audit.py` exit 0 — Mode: AFK — Blocked by: T3

- [x] [auditor] T5: Phase gate — verify M1–M8 and all 3 Hard Rules against raw artifacts; write `Artifacts/Reports/IGH-1-Report.md` — Success: auditor PASS; `pytest tests/ -q` exit 0; `deploy.sh` 6/6 — Mode: HITL — Blocked by: T4

---

## T1 Finding — RDT-1 is DORMANT in every installed geometry plugin

**Answer: DORMANT, not missing. Remedy is a plugin reinstall, not authoring (HR3 satisfied).**
Evidence: `Artifacts/Evidence/IGH-1/igh1_t1_plugin_activation.txt`, `…/igh1_t1_file_presence.txt`

| Install (project) | SHA / ver | RDT-1 `-r` rule | doc-hint guard | no-`-i` clause | GHP-2 `sc.doc` |
|:---|:---|:---:|:---:|:---:|:---:|
| parametric-stadium-bowl-system | `3e2e20b1` (07-06) | DORMANT | DORMANT | DORMANT | DORMANT |
| my_mcp_rhino | `1c00fb3a` (07-06) | DORMANT | DORMANT | DORMANT | DORMANT |
| garden-planner-app | `1.1.0` / `e135b6d8` (07-20) | DORMANT | DORMANT | DORMANT | **LIVE** |
| **repo source** (control) | working tree | LIVE | LIVE | LIVE | LIVE |

**The oracle discriminates** — this is not a blind zero. `e135b6d8` is the direct parent of the
RDT-1 merge `2b9f88d`, so it correctly carries GHP-2 (2026-07-17) while lacking RDT-1
(2026-07-24). A probe that returned DORMANT for everything would be indistinguishable from a
broken grep; this one returns LIVE for exactly the marker the install is new enough to contain.

**Dormant, not absent:** `rhino-e2e-testing/SKILL.md` is present in all three installs. The two
07-06 installs still carry the *pre-RDT-1* Key Rule 3 — "Run `rhinocode list` before
`script`/`command`" — the exact weaker rule RDT-1 replaced. `-r <pipeId>` occurrences: **0** in
all three installs vs **2** in repo source.

**Consequences:**
1. No Rhino rule authoring in IGH-2 — the rules exist and are correct. The gap is distribution.
2. The `/insights` Rhino frictions are consistent with agents following the *old* Key Rule 3.
3. User action required: `/plugin` reinstall of `geometry` in each consuming project. Plugin
   installs pin a SHA and never auto-refresh — `deploy.sh` cannot fix this.

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
