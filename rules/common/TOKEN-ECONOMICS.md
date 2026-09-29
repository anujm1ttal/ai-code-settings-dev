# Token Economics & Context Architecture

Token ROI and context-pressure management. Context Layering (L0/L1/L2) and the Findings
Protocol are owned by `orchestration.md` §Safeguards & Efficiency — not restated here.

## Token Budgeting

| Layer | Token Estimate | Purpose |
|:---|:---|:---|
| L1 (Overview) | ~2,000 | Map of all agents/skills — load first to route |
| L0 (Abstract) | ~100–300 | Single agent/skill summary — confirm fit (mandatory only past 150-line `SKILL.md`) |
| L2 (Definition) | ~3,000–8,000 | Full instruction set — load only when executing |

Standard bootstrap (all rules + L1 overviews): ~15,000 tokens — the budget a CLAUDE.md is one
line item within (`claude-md-standards.md` §3).

## Slicing Thresholds

| Metric | Threshold | Action |
|:---|:---|:---|
| Task Count | 15+ | Split into 2 slices |
| Wave Count | 8+ | Insert a hard gate for context reset |
| Complexity | 200+ points | Mandatory slicing |

## Handoff Triggers

Concierge triggers `/handoff` on: context >60% saturation, a phase marked `[x]`, or noise from
multiple pivots/complex debugging.

## Anti-Patterns

Eager loading (full skill before checking its Abstract) · context hoarding (skipping `/handoff`
at high saturation, risking hallucinated state) · silent reset (ending a session without
capturing Findings or updating `DECISION_LOG.md`).
