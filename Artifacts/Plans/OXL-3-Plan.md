# OXL-3 — Interview Mode (`/blueprint --interview`)

**Status:** Step 0 approved 2026-07-20 · **Branch:** `phase-oxl-3-interview-mode`
**Owner:** strategist (P1 content) → coder (P2 wiring) → auditor (P3 gate)
**Sequencing:** inserted ahead of OXL-2 (OXL-2's gate is a cost reassessment, not a dependency)

---

## 1. Origin & Problem

Import from `mattpocock/skills` `productivity/grill-me` — same external source as the rest of OXL
(see `IMPLEMENTATION_PLAN.md` L6). User's stated need, verbatim:

> "what i am looking for is an interviewer that essentially asks questions to help prepare the plan
> in the first go. sometimes i have ideas which are not very well formulated, but an interviewer
> asks the right question to get the correct answers out of me."

**Gap.** Three surfaces already claim "interview" — `agents/strategist.md` L19-28, `commands/blueprint.md`
L22, `skills/business-analyst/references/elicitation-guide.md` — and all three are **bounded (3–5) and
breadth-first**: checklist sweeps that *confirm* an already-stateable idea. None is unbounded,
dependency-ordered, codebase-first, or terminating on shared understanding rather than question count.
All sit downstream of a formulated idea (`blueprint.md` L21 is literally "Analyze user's project idea").

**Not `/grill`.** `/grill` attacks an existing plan and does that job well. Untouched by OXL-3.

**VALUE_CHECK.** Converts a half-formed idea into a signable problem statement + resolved-decision list
*before* Step 0, so the plan is right on the first pass instead of being refactored at grill.

**VALUE_ROI.** Evidence of fog cost, from this repo's own artifacts: `TODO.md` L12 — OXL `[REFACTORED]`
at grill **twice** (2026-07-09, 2026-07-10); L54 — `VSE-2 (REFACTORED)`. Three refactor cycles, each
≈ one Opus deliberation session, each caused by scope that wasn't stateable at blueprint time. Payoff:
collapse ~1 grill-refactor cycle per foggy initiative. Build cost: markdown only, ~2 days human /
**~1 hour AI-assisted** (~20x).

---

## 2. Decision: flag, not command (why option (d) was rejected)

Recorded so it is not rediscovered. Four options were costed:

| # | Option | New surfaces | Double-interview risk | Verdict |
|:--|:---|:---:|:---|:---|
| (a) | Amend `strategist.md` L21 + `blueprint.md` L22 in place → unbounded always | 0 | none | Reject |
| (b) | Mode flag on `/blueprint` | ~0 | **structurally impossible** | **ADOPTED** |
| (c) | Skill, not command | 1 skill dir + 1 registry row | unresolved | Partial (content only) |
| (d) | New `/interview` command | 5 registry surfaces + 1 artifact type | must be patched | Reject |

**(a) collapses into (b).** Unbounded-always is a regression for well-formulated ideas — it forces a
20-question depth traversal on "add rotation to DECISION_LOG". The bounded 3–5 sweep is *correct* when
the user already knows what they want. So it must be conditional; the condition is the user's own sense
of fogginess; that signal is definitionally a flag.

**(d) — the artifact-chain cost that killed it.** A standalone `/interview` requires `/blueprint` to
*know* an interview already happened, or the user is interviewed twice and abandons the tool. Mechanisms:
- *Chat history* — on the `standards.md` Deny List ("Chat history as sole source of truth"). Dead.
- *An artifact* (`Artifacts/INTERVIEW_BRIEF.md` gating `blueprint.md` step 2) — the only durable option,
  and it buys a **chain**: new artifact type → new owner row in `orchestration.md` §Persistence → a
  staleness rule (is a 3-week-old interview for a *different* idea still suppressing?) → an archive
  policy. Plus rows in `CLAUDE-global.md` L53-56, `cheatsheet.md` L11-34, `orchestration.md` L73-75,
  `GEMINI.md` L32-34.

**(b) does not mitigate double-interview — it deletes it.** One command; step 2 is *either* the bounded
sweep (default) *or* the depth traversal (flagged). Replacement, not suppression: no handshake, no state,
no artifact, nothing to drift. `blueprint.md` already carries a Mode Detection block (L13-18), so
mode-switching is idiomatic there.

**(c) adopted in part.** A skill is model-invoked knowledge; an interview is a user-initiated procedure,
so the *entrypoint* is not a skill. But the *content* is skill-shaped and already has a home —
`elicitation-guide.md`. That is Phase 1.

**Precedent.** `BACKLOG.md` `oxl_wayfinder_1` (filed at the OXL grill 2026-07-09) already ruled on the
adjacent foggy-input problem: *"Design as a `/blueprint` MODE, not a new command."* OXL-3 is consistent
with that ruling rather than contradicting it.

**Naming.** `--foggy` is reserved by `oxl_wayfinder_1` for a different output (map + decision tickets;
revival trigger = "destination unnameable after one grill"). This mode is `--interview`. Wayfinder stays
parked; the overlap is cross-referenced in BACKLOG so the OS never ships two indistinguishable
foggy-input modes.

**Alias deferred, not denied.** A thin `/interview` → `/blueprint --interview` alias is filed as
`oxl_interview_alias` (BACKLOG). Because an alias invokes the *same* command rather than a peer, it needs
no brief artifact, no persistence row, no staleness policy — the chain that killed (d) does not apply.
Explicitly out of OXL-3 scope so Hard Rule 3 stays mechanically enforceable.

---

## 3. Risks & Mitigations

| ID | Risk | Mitigation | Lands in |
|:---|:---|:---|:---|
| **R1** | **Non-termination / interview fatigue.** Unbounded depth-first with no cap runs 30 questions. "Terminates on shared understanding" is subjective and the model is biased toward continuing. | Exit only on a **signed restatement** (problem statement + resolved decisions + explicit unresolved). Checkpoint every 5 questions: emit current restatement, offer "more / proceed". Exit test is a rendered artifact the user accepts, never a model feeling. | P1 §5 |
| **R2** | **Codebase-first is itself unbounded.** "If discoverable, explore instead of asking" invites long Grep/Read excursions between every question, burning context before Step 0 begins (`TOKEN-ECONOMICS.md` puts `/handoff` at 60% saturation). | Hard budget **≤2 tool calls per question**; over budget → stop exploring, ask the user. Report what was found and what it settled; never re-ask a settled question. | P1 §3 |
| **R3** | **Recommended-answer anchoring.** Opus + a fuzzy idea + a confident recommendation = the user rubber-stamps, and the interview produces *the model's* plan wearing the user's voice. Directly defeats the stated purpose ("get the correct answers out of **me**"). | Mechanical, not aspirational: **confidence tag on every recommendation** (`[HIGH]`/`[MED]`/`[LOW]` + basis), and **preference calls get NO recommendation** — name the tradeoff, take no side. Boundary referenced from `standards.md` §Intellectual Honesty (scoped to claims, not preferences), not restated. | P1 §4 |

R3 is the mitigation the feature lives or dies on. It is a **hard gate** at P3 — see §4.

---

## 4. Phased Roadmap

### Phase 1 — Elicitation content
- **Deliverable**: `skills/business-analyst/references/elicitation-guide.md` rewritten, 23 → **≤70 lines**.
- **Adds**: depth-first traversal (order by constraint, not category); one question per turn;
  recommendation protocol with confidence tag + preference-call exemption (R3); codebase-first gate with
  ≤2-tool-call budget (R2); termination test + 5-question checkpoint (R1); worked traversal example.
- **Success Metric**: file ≤70 lines; all 4 existing breadth categories retained (**zero deletions**);
  ≥1 worked traversal example showing a dependency-ordered chain of ≥4 questions; R1/R2/R3 each
  traceable to a named line.
- **Owner**: strategist (content) → scribe (format). **Deps**: none.

### Phase 2 — Entrypoint wiring
- **Deliverables**: `commands/blueprint.md` — `argument-hint` (L4) gains `[--interview]`; step 2 (L22)
  becomes a two-branch conditional (default 3–5 breadth / `--interview` → depth traversal per the guide).
  `agents/strategist.md` L19-28 — one sentence: the MUST-run Step 1 gate is satisfied by *either* mode.
  `cheatsheet.md` — 1 row.
- **Success Metric**: `blueprint.md` ≤70 lines (from 58); `strategist.md` ≤85 lines (from 80); exactly
  **3 files** touched; **0** new files; **0** new rows in `CLAUDE-global.md`, `GEMINI.md`,
  `orchestration.md` §Automatic Routing; `pytest tests/ -v` exit 0.
- **Owner**: coder → auditor. **Deps**: Phase 1.

### Phase 3 — Deploy + live-fire
- **Deliverables**: `bash scripts/deploy.sh` (6-step validation); one real `/blueprint --interview` run
  against a genuinely foggy idea; the `oxl_interview_alias` + `oxl_wayfinder_1` cross-reference verified.
- **Success Metric**: deploy exit 0, 6/6 steps pass; live-fire produces a signed problem statement in
  **≤12 questions** with **≥2** questions answered by codebase exploration instead of asking; default
  `/blueprint` re-run shows unchanged 3–5 behavior.
- **R3 HARD GATE [user-approval]**: user affirms the restatement is **their** idea, not the model's.
  A hedged, qualified, or soft yes counts as **FAIL**, not PASS. Rationale: by Phase 3 the user is
  invested and inclined to wave it through — that inclination is precisely the anchoring failure R3
  predicts, so the gate must reject anything short of an unqualified affirmation. On FAIL: return to
  Phase 1 §4 and harden the recommendation protocol; do not merge.
- **Owner**: coder (deploy) → auditor (gate) → user (R3 judgment). **Deps**: Phase 2.

---

## 5. Hard Rules (auditor rejects on violation)

1. **Default path untouched.** `/blueprint` with no flag runs exactly the existing bounded 3–5 breadth
   interview. Zero new mandatory questions on any existing path. Grep-verifiable: `blueprint.md` step 2's
   default branch is byte-identical to today's L22.
2. **Exactly one interview per blueprint run.** The mode *replaces* step 2; it never runs in addition to
   it. No suppression handshake, no interview-state artifact, no cross-command flag may be introduced to
   achieve this.
3. **Zero new surfaces.** No new command file, no new artifact type, no new row in `CLAUDE-global.md` /
   `GEMINI.md` / `orchestration.md` §Automatic Routing. If the phase starts growing a registry surface, it
   has silently drifted back into rejected option (d) — reject and re-plan.

*Inherited*: OXL Initiative Hard Rule 2 — no executable runner code ships in OXL. OXL-3 is markdown only.
