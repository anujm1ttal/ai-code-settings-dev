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
| 1 | pattern | Scan Exclusions (skip venv, dist, .git) | patterns/index.md | 2026-05-07 |
| 2 | anti-pattern | Artifact Path Validation | anti-patterns/index.md | 2026-04-30 |
| 3 | execution-rule | Mirroring Rule (HARD-GATE) | execution-rules/index.md | 2026-05-07 |
| 4 | project-note | Native Plugins Are the Skill Loader | project-notes/index.md | 2026-07-06 |
| 5 | anti-pattern | Audit All History vs New Config = False Positives | anti-patterns/index.md | 2026-07-06 |
| 6 | execution-rule | Verify Centrally After Parallel Fan-Out | execution-rules/index.md | 2026-07-06 |
| 7 | anti-pattern | Deploy Script Stale After Subsystem Retire | anti-patterns/index.md | 2026-07-06 |
| 8 | project-note | Global vs Project CLAUDE.md Split | project-notes/index.md | 2026-07-06 |
