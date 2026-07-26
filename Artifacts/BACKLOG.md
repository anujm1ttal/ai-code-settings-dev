# Backlog — Deferred Work & Findings

**Searchable memory, not a work queue.** Nothing schedules off this file — an entry resurfaces
when the thing it describes does. Its job is to stop analysis being lost and stop settled
questions being re-litigated. Reference-on-demand (not boot-loaded). ID format:
`<phase>_<component>_<n>`. Lifecycle: `rules/common/orchestration.md` §BACKLOG Lifecycle.

**Archive** (rotated `RESOLVED` entries, append-only) → `Artifacts/History/BACKLOG-archive.md`.

Health check: `python scripts/backlog_audit.py`

---

## `rdt_graduate-source-vs-deployed_1` — /graduate resolves destinations to deployed dir

**Status:** OPEN · **Filed:** 2026-07-24 (RDT session) · **Severity:** MEDIUM (process defect; caused unversioned edits)

During `/graduate`, the concierge subagent applied 6/8 rule edits to `~/.claude/rules/common/*.md`
(the **deployed** copies) instead of the repo source `rules/common/*.md`. Result: edits were
unversioned and would be clobbered on the next `deploy.sh`. Caught via mtime diff and corrected
(`dcd321a`), but the root cause is the command doc.

**Root cause:** `commands/graduate.md` (and its mirror in `~/.claude/`) lists destinations as bare
`rules/common/coding-style.md` etc. — ambiguous between repo source and the deployed tree. A
subagent with `~/.claude/` on its path resolved them there.

**Action when picked up:**
- State in `graduate.md` that destinations are **repo source** (`<repo>/rules/common/…`), and that
  `deploy.sh` is the only path to production — never edit `~/.claude/` directly.
- Consider a guard: block `/graduate` (and graduation-authoring agents) from writing outside the
  workspace root. Overlaps with the existing `guard-paths.js` scratch-gate philosophy.
- General lesson (candidate `/learn`): any command whose destinations are bare relative paths is
  ambiguous once a subagent has the deployed tree on its path — qualify source-vs-deployed.

---

## `oxl_mcp-rhino-scaffold` — graduate the MCP-over-socket "drive live Rhino" stack

**Status:** OPEN · **Filed:** 2026-07-17 (GHP-1, user parked) · **Severity:** LOW (feature, no defect)

The `my_mcp_rhino` project has a mature, reusable architecture for driving a LIVE Rhino from an
external MCP server that was NOT graduated in GHP-1 (user chose to skip — not needed for a
GH-plugin project). If a reusable Rhino-MCP scaffold is ever wanted, the graduation candidates
(all verified project-agnostic in GHP-1 mapping) are:
- `connection_utils.py` `LazyConnection` — length-prefixed JSON socket, reconnect/ping, drain-until-full recv (needed for >64KB payloads)
- `threading_utils_base.py` `marshal_to_rhino_thread` — `RhinoApp.InvokeOnUiThread` + Event + timeout; the canonical "run RhinoCommon safely from a background socket thread" primitive
- `server_base.py` — command whitelist + param sanitize + validator registry + automatic `BeginUndoRecord`/`EndUndoRecord` wrap; `COMMAND_METADATA` (`requires_document`/`modifies_document`)
- `main.py` — `scriptcontext.sticky` server survival + `sys.modules` purge for live-reload of edited in-Rhino code
- `rhino_mcp/rhinomcp/server.py` — FastMCP + env-configured host/port + one-file-per-tool `tools/` layout
- (adjacent) viewport-capture-over-MCP tool (`CaptureToBitmap` → JPEG → base64 in the JSON envelope; CLR gotcha: JPEG quality must be `System.Int64`)

**Action when picked up:** likely a new `rhino-mcp-server` skill (or architecture reference under
`python-rhino-grasshopper`). Strip all gBlox command/channel specifics. Not routed under any
project type until a consumer exists.

---

## `oxl_routing-violations_1` — 21 historical model-routing violations in session transcripts

**Status:** OPEN · **Filed:** 2026-07-10 (OXL-1 T9 smoke run, routing audit) · **Severity:** MEDIUM

`python scripts/model_routing_audit.py --violations-only` (unscoped) reports 21 violations across
4 historical sessions: `0034d334` (13× coder/auditor/strategist ran on Haiku), `b0910c55`
(6× coder inherited the main-session model `claude-fable-5` instead of Sonnet binding),
`c265a752` (scribe on Sonnet), `550a42d0` (auditor on `qwen3.5-tuned` — non-Anthropic model,
investigate how). All predate OXL-1; today's session (`df244fcd`) is clean 13/13.
**Action when picked up:** determine whether these were deliberate alternate-model sessions
(then document + exclude via `--since` convention) or a real routing bypass (then root-cause).
The `/afk` runner's routing-audit metric is date-scoped (`--since <run date>`) precisely so this
historical noise cannot poison future gates.

---

## `oxl_wayfinder_1` — `/blueprint --foggy` (wayfinder decision-ticket mode) deferred

**Status:** OPEN · **Filed:** 2026-07-09 (OXL grill cut) · **Severity:** LOW · **Needs:** demand evidence, then Step 0

Wayfinder pattern (mattpocock/skills): for initiatives whose destination can't be named, chart a
map (Destination / Decisions-so-far / Not-yet-specified fog / Out-of-scope) + child decision
tickets (research/prototype/grilling/task) sized to one session — "tickets resolve decisions, not
deliverables." Cut at OXL grill: zero observed demand (every past initiative's fog was burned off
by /blueprint + one /grill session). **Revival trigger:** an initiative arrives whose destination
still can't be named after one grill session. Design as a `/blueprint` MODE, not a new command;
map reuses existing artifact types.

**Adjacent — do not conflate:** OXL-3 shipped `/blueprint --interview` (depth-first requirements
traversal → problem statement + resolved-decision list). Same trigger neighborhood (foggy input),
**different output**: wayfinder emits a map + child decision tickets; `--interview` emits a signed
restatement feeding Step 0. `--foggy` remains reserved for this entry. If wayfinder is ever revived,
first rule whether `--interview` already covers the demand — the OS must not ship two
indistinguishable foggy-input modes.

---

## `oxl_interview_alias` — thin `/interview` alias for `/blueprint --interview`

**Status:** OPEN · **Filed:** 2026-07-20 (OXL-3 Step 0, user-approved deferral) · **Severity:** LOW · **Needs:** demand evidence

A one-line `/interview` command that does nothing but invoke `/blueprint --interview`. Purely a
discoverability/ergonomics win — a mode flag is less findable than a slash command, and the user may
want to reach for the interviewer *before* they've framed the work as "starting a blueprint."

**Why this is cheap where standalone `/interview` was not.** OXL-3 rejected a standalone `/interview`
(option (d)) because a *peer* command needs `/blueprint` to know an interview already happened, which
forces an `INTERVIEW_BRIEF` artifact → a persistence row in `orchestration.md` → a staleness policy →
an archive policy. An **alias invokes the same command**, so step 2 is still replaced exactly once and
that whole chain evaporates. Cost is one file + registry rows, not a new artifact type.

**Revival trigger:** the user reaches for a standalone interview entrypoint **twice** in real use
(i.e. types `/interview` or asks for it when `--interview` exists).

**Explicitly OUT of OXL-3 scope** — implementing it inside OXL-3 would violate OXL-3 Hard Rule 3
("zero new surfaces"), which is what keeps that rule mechanically checkable. See
`Artifacts/Plans/OXL-3-Plan.md` §2. Cross-ref: `oxl_wayfinder_1` (adjacent foggy-input mode).

---

## `vse2_yaml-dep_1` — PyYAML undeclared; YAML schema tests skip silently without it

**Status:** OPEN · **Filed:** 2026-07-09 (VSE-2 audit ruling) · **Severity:** LOW · **Needs:** small dep-declaration pass

The VSE-2 schema-sanity tests guard on `pytest.mark.skipif(yaml is None)`. PyYAML 6.0.3 is present
in the current env (tests ran, 0 skipped — audit-verified) but the repo declares NO dependencies at
all (no `pyproject.toml`/`requirements.txt`) — a pre-existing gap, not introduced by VSE-2. In a
PyYAML-less env the schema gate vanishes silently. The safety-critical gate (`contrast_check.py`,
stdlib-only) is unaffected. **Fix:** declare PyYAML as a dev dependency when the repo gains a
`pyproject.toml` (fits the uv workflow in `python-patterns` §uv Workflow: `uv add --dev pyyaml`).
**Re-verified 2026-07-26 (BLR-1):** still accurate — no `pyproject.toml`, `requirements.txt`, or
`setup.py` exists.

---

## `vse2_layout-menu-dup_1` — templates' "Layout Menu" table partially repeats archetype data

**Status:** OPEN · **Filed:** 2026-07-09 (VSE-2 audit, LOW, non-blocking) · **Severity:** LOW · **Needs:** doc pass

`references/slide-prompt-templates.md` §"Layout Menu & How Part 6 Varies" (pre-existing, VSE-1-era)
repeats archetype names + short zone text now single-sourced in `data/archetypes.yaml`. Different
schema (no intent/when_to_use) and outside VSE-2's approved file list, so not an HR4 violation for
that phase — but it's residual duplication. Fix: repoint that table to `data/archetypes.yaml` in a
future doc pass (batch with `osh_docs-count_1`).

---

## `lh3_telemetry-deploy_1` — Gate telemetry reader is repo-local; hooks log everywhere

**Status:** OPEN · **Filed:** 2026-07-08 (LH-3 ship) · **Severity:** LOW · **Needs:** product decision

`hooks/lib/gate-log.js` deploys with the hooks, so `gate_events.jsonl` is written in EVERY project.
But `scripts/gate_telemetry.py` (the reader) is not deployed (`deploy.sh` excludes `scripts/` by
design; see repo CLAUDE.md). So `/handoff`'s telemetry step only produces a table inside the
ai-code-settings repo. Made graceful in LH-3 (`commands/handoff.md` now skips the sub-step when
the script is absent rather than erroring). **Enhancement (deferred):** to close the telemetry loop
globally, either deploy `gate_telemetry.py` to `~/.claude/` (policy change — scripts currently not
deployed) or fold a minimal reader into a deployed location. Product call: is per-project gate
telemetry worth the deploy-policy change, or is repo-local dev observability sufficient?

**Second instance (2026-07-26, BLR-1):** `scripts/backlog_audit.py` hits the identical wall — it is
repo-local, so it cannot audit `my_mcp_rhino`'s backlog (the one that actually rotted). Mitigated
there by zero repo imports (copyable standalone) + the same graceful-skip wiring. This is now a
**two-instance pattern**, which strengthens the case for resolving the deploy policy rather than
mitigating per-tool a third time.

---

## `cmd_gemini-parity_1` — GEMINI.md holds old combined (pre-split) content

**Status:** OPEN · **Filed:** 2026-07-06 (CMD, deferred out of scope) · **Severity:** LOW · **Needs:** product decision

When CLAUDE.md was split into `CLAUDE-global.md` (deployable) + lean repo `CLAUDE.md` (CMD
initiative, `a393e2b`), `GEMINI.md` was left holding the old combined content — it is a manual
parallel mirror for Gemini/Antigravity and is **not** deployed. Out of scope per CMD Step 0.
Also surfaced by LH closure ("Deferred: GEMINI.md parity"). **Decision needed:** is Gemini
parity still wanted? If yes, re-sync GEMINI.md to the split structure; if no, close this and
note GEMINI.md as intentionally-divergent/unmaintained.

**Drift note (2026-07-26, BLR-1):** the decision is being answered *de facto* by behavior —
`GEMINI.md` received an ad-hoc edit in the EVD phase (Evidence-retention line) while this entry
still sits open asking whether to maintain it. Either ratify parity or close the entry; the
current state is the worst of both.

---

## `osa_subagent-tier_1` — Subagents may run on the wrong model tier

**Status:** OPEN · **Filed:** 2026-07-06 (OSA B5) · **Severity:** MEDIUM · **Needs:** separate Step 0 + runtime probe

OSA finding: subagents appeared to run on a default tier (haiku) rather than the tier their
`model:` frontmatter declares (sonnet/opus) — i.e. the runtime may ignore per-agent `model:`.
Not fixed in OSA (needs its own Step 0). Related: `rules/common/model-routing.md` §Verification
(`scripts/model_routing_audit.py --violations-only`) and the `statusline-model-visibility`
memory (subagentStatusLine schema pending post-restart verify). **Next:** run the routing audit
from live subagent transcripts to confirm/refute before scoping a fix — config being correct
does not prove the runtime honors it.

---

## `osh_docs-count_1` — Stale "17 skills" count in out-of-scope docs

**Status:** OPEN · **Filed:** 2026-07-07 (OSH-4) · **Severity:** LOW · **Needs:** doc pass

OSH-4 moved `business-analyst` from the manuscript plugin to core, dropping the
optional-plugin skill count 17 → 16. Two files still say "17 skills" but were
**not** in OSH-4's approved file list, so they were left untouched per Hard Rule 2
(deletions/edits enumerated-only):

- `README.md` (3 occurrences)
- `Artifacts/MEMORY_ANCHORS.md` (2 occurrences)

Fix: update both to 16 (or point them at `optional_plugins/index.md` as the single
source of truth for the count, matching the `skills.overview.md:5` DRY fix applied
in OSH-4). Trivial; batch into any future doc-sync pass.
**Re-verified 2026-07-26 (BLR-1):** still accurate — grep confirms 3 and 2 occurrences.
