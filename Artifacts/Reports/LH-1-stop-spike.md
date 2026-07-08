# LH-1 T5 — Stop-Block Empirical Spike

**Date:** 2026-07-08 · **Runtime:** Claude Code CLI 2.1.201, non-interactive `-p` mode, model `haiku`
**Method:** `Artifacts/Temp/lh1-stop-spike/` (deleted after this report was written) — 4 sandbox
dirs, each with a `.claude`-style `--settings <file>` registering a Stop hook that appends to
`invocations.log` and then attempts one of the 3 variants. Invoked via
`claude -p "Reply with exactly the single word OK and nothing else." --settings <file> --output-format json --model haiku`,
each run bounded by a shell `timeout` (40-55s, within the ≤60s cap).

## Result Summary

| Variant | Mechanism | Hook fired | `num_turns` | Wall time | Outcome |
|:--|:--|:--:|:--:|:--:|:--|
| Control | fires, does nothing | 1 | 1 | 2.6s | Normal completion, `result:"OK"` |
| (a) exit 2 + stderr | `process.exit(2)` + stderr reason | 5-6 | n/a | ≥55s (killed) | **Never completed** — `timeout` had to SIGTERM it (exit 124), zero stdout ever produced |
| (b) `decision:block` | stdout `{"decision":"block","reason":...}`, exit 0 | 9 | 10 | 22.2s | `terminal_reason:"completed"` but **`result:""`** — empty final assistant output |
| (c) `additionalContext`-only | documented Stop schema, exit 0 | 9 | 1 (billing) | 29.8s | `terminal_reason:"completed"` — model's own final text explicitly says *"the stop hook is preventing me from ending... Is this testing the hook behavior itself?"* |

## Verdict

**All three variants empirically prevented/delayed turn-end and caused the Stop hook to be
re-invoked multiple times**, in this runtime and mode — contradicting the plan's B5 doc-only
assumption that `additionalContext`-only is feedback-only with no blocking power. This spike's
hooks deliberately ignored the `stop_hook_active` field the harness passes on the Stop event
(the documented anti-infinite-loop contract) to observe the harness's raw retry ceiling; that
ceiling differed sharply by variant:

- **(a) exit-2 is the most aggressive and the riskiest**: no observed ceiling — it did not
  self-resolve within 55s and had to be force-killed. A production hard-gate built on exit-2
  that never satisfies its own condition risks **hanging a live session indefinitely** if it
  does not also check `stop_hook_active`.
- **(b) `decision:block`** has a bounded retry ceiling (~9 attempts observed) but the harness's
  own give-up path produced a **broken result** (`result:""`, no assistant text) — a bad
  reliability/UX signal for a documented mechanism.
- **(c) `additionalContext`-only** also blocked in practice (9 re-invocations), but this is
  **not the documented mechanism** — the schema has no deny/block field (B5), so this
  blocking-like effect looks like a side effect of feeding block-styled text back into context
  (the model itself narrated the confusion) rather than a protocol-level gate. Relying on it
  would mean relying on undocumented, fragile behavior.

**Recommended LH-2 design** (if a hard gate is pursued): use `decision:block` (the only variant
with both a documented-adjacent JSON contract and a bounded retry ceiling in this spike), and
the hook **MUST** read and honor `stop_hook_active` to block **at most once per Stop event
chain** — never unconditionally, given exit-2's demonstrated unbounded-hang risk. Given (b)'s
own empty-result failure mode even with honoring the harness's retry ceiling, LH-2 should default
to the **evidence-nag design** (T4's pattern: nudge via `additionalContext`, never a hard block)
unless a follow-up spike with `stop_hook_active` properly honored shows `decision:block`
producing clean, non-empty completions.

## Caveats

1. **Non-interactive `-p` mode only.** Interactive session Stop-hook behavior (LH-2's actual
   production context) was not tested and may differ — recursion-guard thresholds, UI
   presentation of a blocked stop, and user-visible retry behavior are all unverified for the
   interactive path.
2. **Spike hooks intentionally ignored `stop_hook_active`** to observe the harness's raw
   ceiling — a real LH-2 implementation must check it; the observed per-variant retry counts
   are upper bounds on what happens *without* that check, not what a compliant implementation
   would produce.
3. **Real API cost incurred**: ~$0.10-0.11 per run (haiku, cache-creation-heavy) × 4 runs
   (~$0.43 total) — testing was stopped at 4 runs (control + one pass per variant) once a clear
   verdict emerged, per the ≤60s/half-day investigation cap; no additional exploratory runs
   (e.g., re-testing exit-2 with a longer bound, or testing `stop_hook_active` handling) were
   made.
4. Session IDs captured from the completed runs' JSON output: control
   `7e00c621-54d6-411c-a464-70537e5a9986`, (b) `decision:block`
   `f5ac695b-f1d8-4548-882e-4501b3486552`, (c) `additionalContext`-only
   `2f017edb-beba-4288-b0d4-4ae5bc82d01c`. (a) exit-2 never completed (killed
   by `timeout`, zero stdout produced), so no session ID exists for either
   exit-2 run. The sandbox directories themselves were deleted after this
   report was written (Scratch Strategy HARD-GATE — no spike code ships to
   `hooks/`, per T5's scope).
