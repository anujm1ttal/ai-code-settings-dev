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
