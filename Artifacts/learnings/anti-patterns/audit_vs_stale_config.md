# Auditing All History Against a New Config = False Positives

**Category:** anti-pattern · **Filed:** 2026-07-06 (Phase OSA)

## The trap

The model-routing audit flagged "21 of 45 subagent runs bypassed their assigned
tier" — read as a live HIGH bug. It was a **false positive**: routing config only
existed from July 3, but the tool audited transcripts back to June against it.
Scoping to post-config runs (`--since 2026-07-05`) → **0 violations**. The
"violations" were pre-config sessions + deliberate alternate-model runs (a full
Fable session, Qwen experiments).

## Rule

When a verification tool compares runtime history against a config, it MUST be
scoped to the window where that config was in effect. Otherwise it re-flags
historical/experimental data forever and cries wolf. Added `--since` to the tool.

## Meta-lesson

The tool was *right* that mismatches existed but *wrong* to imply they were
current. Before treating an audit finding as a live bug, check WHEN the flagged
events occurred relative to the config. Devil's-advocate the tool, not just the
user.
