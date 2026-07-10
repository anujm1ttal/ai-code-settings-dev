# Hot Learnings (Active Context)

Top-30 patterns, gotchas, and rules actively relevant to current work.
Concierge reads this first during `/sync` boot. Promotes/demotes during `/handoff`.

## Lifecycle Rules
- **Promote**: Entry referenced 3+ times across sessions, or flagged `--hot` during `/learn`
- **Demote**: Not referenced in 30+ days
- **Cap**: Max 30 entries. When exceeded, demote oldest by `Last Referenced` date

## Active Entries

| # | Category | Title | Source | Last Referenced |
|:---|:---|:---|:---|:---|
| 1 | execution-rule | Deploy.sh Rollback: Scoped-Item Replace, Never Full-Wipe | execution-rules/index.md | 2026-07-08 |
| 2 | pattern | Guard Hook — Recursive Deletes & Dangerous Strings Require Manual Execution | patterns/index.md | 2026-07-10 (OXL: hooks don't parse TODO format — additive fields safe) |
| 3 | pattern | Scan Exclusions (skip venv, dist, .git) | patterns/index.md | 2026-05-07 |
| 4 | anti-pattern | Artifact Path Validation | anti-patterns/index.md | 2026-04-30 |
| 5 | execution-rule | Mirroring Rule (HARD-GATE) | execution-rules/index.md | 2026-05-07 |
| 6 | project-note | Native Plugins Are the Skill Loader | project-notes/index.md | 2026-07-07 |
| 7 | anti-pattern | Audit All History vs New Config = False Positives | anti-patterns/index.md | 2026-07-07 |
| 8 | execution-rule | Verify Centrally After Parallel Fan-Out | execution-rules/index.md | 2026-07-07 |
| 9 | anti-pattern | Deploy Script Stale After Subsystem Retire | anti-patterns/index.md | 2026-07-07 |
| 10 | project-note | Global vs Project CLAUDE.md Split | project-notes/index.md | 2026-07-07 |
| 11 | anti-pattern | Enforcement Config Never Runtime-Verified | anti-patterns/index.md | 2026-07-07 |
| 12 | anti-pattern | Refactors Leave Cross-Registry Drift | anti-patterns/index.md | 2026-07-07 |
