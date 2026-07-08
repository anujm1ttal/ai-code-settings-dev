# LH-1 Plan — Mechanical Hooks + Stop-Block Spike

**Initiative:** LH — Loop Hardening · **Owner:** strategist · **Implementer:** coder · **Gate:** auditor
**Step 0 approved:** 2026-07-08 · **Grill:** [REFACTORED] 2026-07-08 (4 phases → 3; see DECISION_LOG)
**Branch:** `phase-lh-1-mechanical-hooks`

## Purpose

Ship the hook work that is *doc-verified feasible today*: upgrade `auto-lint.js` from
report-only to loud auto-injected feedback, add the two PreToolUse hard gates that survived
the grill (scratch-gate, commit-trailer), add the Stop-event handoff nudge, and run the
empirical spike that determines LH-2's shape.

## Binding decisions (grill verdicts — coder does not re-litigate)

| # | Decision | Evidence |
|:--|:---|:---|
| B1 | **No PostToolUse blocking.** PostToolUse output schema has no deny field — `additionalContext` only. The dirty-flag state machine is CUT (wedge risk in every global session outweighs value). | Hook docs check 2026-07-08 (claude-code-guide, code.claude.com/docs/en/hooks) |
| B2 | **Hard-deny only at PreToolUse** (`permissionDecision: "deny"` + reason, or exit 2). | same |
| B3 | **TODO-authority hook KILLED** — hook input carries no agent identity; a gate that cannot see the caller only pretends to gate. Authority table stays as prose. | same |
| B4 | **HK-G2 (PreCompact) unimplementable** — PreCompact is absent from the current hook-events list. BACKLOG corrected. | same |
| B5 | **Stop-block semantics UNKNOWN** — docs say Stop "can block continuation" but schema shows only `additionalContext`. T5 spike resolves empirically; LH-2 branches on the verdict. | same |
| B6 | All new gates **fail-open on script error** (exit 0); blocking is reserved for evaluated conditions. | Initiative Hard Rule 1 |

## Tasks — Technical Approach

### T1 — `auto-lint.js`: soft report → loop-closing directive (coder)
**Recon correction (2026-07-08):** the hook ALREADY emits `additionalContext` via the correct
PostToolUse schema and ALREADY has the per-extension `LINTER_MAP` (.py→ruff, .ts/.tsx→tsc,
.js→eslint) with fail-open on missing binary + 2000-char cap. This is NOT a build-from-scratch;
the plumbing is done. The **only** defect is the directive wording: current message says
*"Report these to the user and wait for approval before fixing"* — that is the OPPOSITE of a
feedback loop (it defers to the user instead of closing the loop).
- **Scope of T1:** change that trailing directive to loop-closing —
  `"LINT FAILED (ruff, N issues): <output> — fix before proceeding."` Keep the existing schema,
  map, fail-open, and cap (tighten to ~30 lines only if trivial). Add issue count if cheap.
- **Do NOT** rewrite the plumbing or touch the linter map.
- **Stance conflict (flag, do not silently absorb):** this reverses `coding-style.md`'s
  "report-only, no auto-fix" and staledates the `CLAUDE-global.md` hooks-table description
  ("report-only, no auto-fix"). Both are correct to change under the loop-hardening mandate
  (lint fixes are mechanical/safe), but the doc-sync is a **tracked LH-3 item** (recorded in
  `Plans/LH-3-Plan.md` §T3b), not silent. Separately, the changed hook's OWN header comment
  (`hooks/auto-lint.js` "Report Only" / "Does NOT auto-fix") MUST be corrected in THIS phase —
  it is part of the T1 file and now actively misstates the file's behavior.

### T2 — Scratch-gate: extend `guard-paths.js` (HK-G3) (coder)
- Deny Write/Edit/NotebookEdit targeting **project-state files under shadow paths**: any of the known state basenames (`TODO.md`, `IMPLEMENTATION_PLAN.md`, `HANDOFF_BRIEF.md`, `DECISION_LOG.md`, `BACKLOG.md`, `ARCH.md`, `AUDIT_REPORT.md`, `LAYOUT_SPEC.md`) under `~/.claude/projects/**`, plus any write to a bare `scratch/` dir outside the harness scratchpad.
- **Allowlist (must not break the harness):** `~/.claude/projects/**/memory/**` (native memory feature), `**/tool-results/**`, harness scratchpad temp paths. Blocking all shadow writes would break Claude Code itself — the gate targets *state-file* basenames only.
- Deny reason must name the correct destination: "project state belongs in `<workspace>/Artifacts/` (orchestration.md HARD-GATE)".

### T3 — Commit-trailer guard: extend `guard-commands.js` (HK-G4) (coder)
- Matcher already covers `Bash|PowerShell`. Deny `git commit` invocations whose args match `/Co-Authored-By:.*Claude/i` or `/Generated with.*Claude Code/i` — including heredoc and PowerShell here-string message forms.
- Deny reason: "strip the attribution trailer and re-run (deny-list, standards.md)".
- Must NOT fire on: commit messages merely mentioning the word Claude in prose, non-commit git commands, `git log`/`show` output greps.

### T4 — Handoff nudge: Stop hook (HK-G1) (coder)
- New `nudge-handoff.js` on Stop: if the session's cwd git tree is dirty (or `Artifacts/TODO.md` modified this session via transcript scan) AND no `/handoff` occurred in the transcript tail → inject `additionalContext` nudge suggesting `/handoff`. **Nudge only — never block**, regardless of T5's verdict.
- Rate-limit: fire at most once per session (marker file in scratchpad/temp, not in Artifacts).

### T5 — Stop-block spike (coder, ~half-day cap)
- Sandbox settings + minimal Stop hook; empirically test, in this runtime: (a) exit 2 + stderr, (b) JSON `{"decision":"block","reason":...}`, (c) `additionalContext`-only. Record whether each can actually prevent turn-end.
- Verdict doc → `Artifacts/Reports/LH-1-stop-spike.md`: mechanism / result / transcript evidence per variant, plus the recommended LH-2 design (hard gate vs evidence-nag).
- This task is **investigation, not feature** — no spike code ships to `hooks/`.

## Success Metrics (auditor gate)

| Task | Metric |
|:--|:---|
| T1 | Seeded `.py` lint violation → additionalContext contains lint output + directive (test); clean edit → no injection; ruff absent → exit 0, no output (fail-open test) |
| T2 | Seeded `TODO.md` write under a fake shadow path → denied with Artifacts/ reason; write to `memory/MEMORY.md` under same root → allowed (false-positive test) |
| T3 | Seeded trailer commit denied in BOTH Bash heredoc and PowerShell here-string forms; trailer-free commit + prose-"Claude" commit both allowed |
| T4 | Dirty-tree stop → nudge present in output; clean-tree stop → silent; second stop same session → silent (rate-limit test) |
| T5 | `LH-1-stop-spike.md` exists with a recorded verdict + transcript evidence for all 3 variants |
| All | Forced-crash test on every touched hook exits 0 (Hard Rule 1); `pytest tests/ -v` exit 0; `bash scripts/deploy.sh` passes and live `~/.claude/hooks/` verified updated |

## Hard Rules (initiative-wide, auditor rejects on violation)

1. Hook malfunction always exits 0 — blocking only for evaluated conditions, never for hook errors.
2. Every deny message states the exact unblock condition.
3. No prose moves out of always-loaded context in this phase (that is LH-3, gated on verified + deploy-guarded hooks).
4. Phase close = deploy (`bash scripts/deploy.sh`) + live verification — repo-only changes are not "done" (carried from OSH).
