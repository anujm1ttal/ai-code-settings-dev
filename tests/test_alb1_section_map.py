"""ALB-1 T1 (RED) — Plan Sec5 "Section to home map" encoded as a fixture table.

Every row below traces to a line in the ALB-1 plan's Sec5 section map. Hard Rule 1
requires moved text to be byte-identical except headings/pointer lines, so MOVE anchors
are verbatim substrings copied from the CURRENT source file (not paraphrased) — a passing
MOVE row proves the anchor now lives only in its home, not in the source it left.

Disposition semantics:
  MOVE     -- anchor must appear in the home file AND disappear from the source file.
  DROP-DUP -- a surviving copy already exists elsewhere; only that copy is asserted.
  SCOPE    -- the source file gains `paths:` frontmatter instead of moving (claude-md-standards).
  ABSENT   -- the whole source file must no longer exist under rules/common/.

This file intentionally encodes a FUTURE state: on `main`/pre-move, every MOVE/ABSENT/SCOPE
row fails for a stated reason (see each assertion message). DROP-DUP rows assert content
that already exists pre-diet, so they pass now and must keep passing.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
FM = re.compile(r"\A---\r?\n(.*?)\r?\n---", re.S)


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def _rel(*parts: str) -> Path:
    return REPO_ROOT.joinpath(*parts)


@dataclass(frozen=True)
class Case:
    id: str
    plan_row: str  # Plan Sec5 row this traces to, for audit cross-reference
    check: Callable[[], None]


def _move(source: Path, home: Path, anchor: str) -> None:
    src_text = _read(source)
    home_text = _read(home)
    home_has_it = home.exists() and anchor in home_text
    if not home_has_it:
        # Move not done yet -- the fixture-staleness guard only applies pre-move: if the
        # anchor isn't in source either, the row itself was mis-derived (never re-checkable
        # once MOVE is done, since a completed move necessarily removes it from source --
        # up to and including deleting the whole source file, e.g. TOKEN-ECONOMICS.md).
        assert source.exists(), f"fixture stale: source file missing: {source}"
        assert anchor in src_text, (
            f"fixture stale: anchor {anchor!r} no longer present in current source {source} "
            "-- re-derive the anchor from the live text before trusting this row"
        )
    assert home_has_it, f"MOVE not done: anchor {anchor!r} absent from home {home}"
    assert anchor not in src_text, (
        f"MOVE not done: anchor {anchor!r} still present in source {source}"
    )


def _move_any_home(source: Path, homes: list[Path], anchor: str) -> None:
    """Same as _move, but the anchor may land in any one of several destination files
    (used when Plan Sec5 lists multiple homes for one source section)."""
    src_text = _read(source)
    found = any(anchor in _read(h) for h in homes)
    if not found:
        assert source.exists(), f"fixture stale: source file missing: {source}"
        assert anchor in src_text, f"fixture stale: anchor {anchor!r} absent from source {source}"
    assert found, f"MOVE not done: anchor {anchor!r} absent from every candidate home {homes}"
    assert anchor not in src_text, (
        f"MOVE not done: anchor {anchor!r} still present in source {source}"
    )


def _move_any_glob(source: Path, glob_root: Path, glob_pattern: str, anchor: str) -> None:
    """Like _move_any_home, but the destination directory (rules/lang/) doesn't exist yet
    pre-move, so homes are discovered by glob rather than named up front."""
    src_text = _read(source)
    candidates = sorted(glob_root.glob(glob_pattern)) if glob_root.exists() else []
    found = any(anchor in _read(c) for c in candidates)
    if not found:
        assert source.exists(), f"fixture stale: source file missing: {source}"
        assert anchor in src_text, f"fixture stale: anchor {anchor!r} absent from source {source}"
    assert found, (
        f"MOVE not done: anchor {anchor!r} absent from every {glob_pattern} file under "
        f"{glob_root} (found {len(candidates)} candidate file(s))"
    )
    assert anchor not in src_text, (
        f"MOVE not done: anchor {anchor!r} still present in source {source}"
    )


def _dropdup(home: Path, anchor: str) -> None:
    assert home.exists(), f"surviving copy missing: {home}"
    text = _read(home)
    assert anchor in text, f"surviving copy at {home} lacks expected anchor {anchor!r}"


def _dropdup_all(pairs: list[tuple[Path, str]]) -> None:
    for home, anchor in pairs:
        _dropdup(home, anchor)


def _scope(file: Path, required_globs: list[str]) -> None:
    assert file.exists(), f"fixture stale: {file} missing"
    text = _read(file)
    m = FM.match(text)
    assert m, f"SCOPE not done: {file} carries no frontmatter block yet"
    fm_body = m.group(1)
    assert re.search(r"(?m)^paths\s*:", fm_body), (
        f"SCOPE not done: {file} frontmatter has no `paths:` key"
    )
    missing = [g for g in required_globs if g not in fm_body]
    assert not missing, f"SCOPE incomplete: {file} `paths:` missing glob(s) {missing}"


def _absent_from_rules_common(filename: str) -> None:
    p = _rel("rules", "common", filename)
    assert not p.exists(), (
        f"ABSENT not done: {p} still present under rules/common/ (must be rehomed/deleted, "
        "see Plan Sec3 drift-guard note before deleting outright)"
    )


CLAUDE_GLOBAL = _rel("CLAUDE-global.md")
ORCHESTRATION = _rel("rules", "common", "orchestration.md")
TESTING_STRATEGY = _rel("rules", "common", "testing-strategy.md")
SECURITY = _rel("rules", "common", "security.md")
CODING_STYLE = _rel("rules", "common", "coding-style.md")
MODEL_ROUTING = _rel("rules", "common", "model-routing.md")
TOKEN_ECON = _rel("rules", "common", "TOKEN-ECONOMICS.md")
CLAUDE_MD_STANDARDS = _rel("rules", "common", "claude-md-standards.md")
AGENTS_OVERVIEW = _rel("agents", "agents.overview.md")
HOOKS_README = _rel("hooks", "README.md")
SCRIPTS_README = _rel("scripts", "README.md")
SKILLS_OVERVIEW = _rel("skills", "skills.overview.md")
RULES_LANG_DIR = _rel("rules", "lang")


CASES: list[Case] = [
    # --- CLAUDE-global.md ---
    Case(
        "cg_commands_table",
        "CLAUDE-global Commands table -> agents/agents.overview.md Sec Commands",
        lambda: _move(
            CLAUDE_GLOBAL,
            AGENTS_OVERVIEW,
            "| `/blueprint` | strategist | ROI-driven project planning, phased roadmaps |",
        ),
    ),
    Case(
        # Orchestrator ruling §5a.1: DROP-DUP iff hooks/README.md's own Hook Reference
        # covers every hook/event/purpose fact -- verified complete (T8 finished, all 9
        # hooks covered, several rows more detailed). Anchored on README's OWN current
        # text, not CLAUDE-global's old phrasing (which no longer exists anywhere).
        "cg_hooks_table",
        "CLAUDE-global Hooks table -> DROP-DUP hooks/README.md Hook Reference (own text)",
        lambda: _dropdup(
            HOOKS_README,
            "Injects `current_task.md` whole when space permits (otherwise visibly trimmed; per-file cap 2,000 B)",
        ),
    ),
    Case(
        "cg_concierge_ops_dropdup",
        "CLAUDE-global Concierge Ops -> DROP-DUP agents/concierge.md + commands/sync.md",
        lambda: _dropdup(
            _rel("commands", "sync.md"),
            "Reconciles manual user progress with the AI's project state.",
        ),
    ),
    Case(
        "cg_youtube_pipeline_dropdup",
        "CLAUDE-global YouTube Pipeline -> DROP-DUP commands/script.md + commands/pack.md",
        lambda: _dropdup_all(
            [
                (_rel("commands", "script.md"), "Artifacts/VIDEO_PLAN.md"),
                (_rel("commands", "pack.md"), "Artifacts/SCRIPT.md"),
            ]
        ),
    ),
    # --- orchestration.md ---
    Case(
        # Orchestrator ruling (HR1 fix, post-T2/T5/T6 verification): the Write Scope column
        # (e.g. the auditor row's "Reports, never applies" clause) is normative text with no
        # surviving copy elsewhere -> MOVE, not DROP-DUP.
        "orch_fleet_table",
        "orch Fleet table -> MOVE agents/agents.overview.md (Write Scope column)",
        lambda: _move(
            ORCHESTRATION,
            AGENTS_OVERVIEW,
            "Reports, never applies — a needed source/test fix is a report line, not an edit.",
        ),
    ),
    Case(
        "orch_project_type_routing",
        "orch Project Type Routing -> agents/agents.overview.md",
        lambda: _move(
            ORCHESTRATION,
            AGENTS_OVERVIEW,
            "cd-foundations, python-rhino-grasshopper, rhino-e2e-testing, rhino-unit-testing, "
            "grasshopper-plugin-packaging, python-patterns",
        ),
    ),
    Case(
        "orch_persistence_file_table",
        "orch Persistence file table -> agents/concierge.md",
        lambda: _move(
            ORCHESTRATION,
            _rel("agents", "concierge.md"),
            "| `MEMORY_ANCHORS.md` | Strategist | Cold storage: constants/constraints, never archived |",
        ),
    ),
    Case(
        "orch_decision_log_rotation",
        "orch DECISION_LOG Rotation -> commands/handoff.md",
        lambda: _move(
            ORCHESTRATION,
            _rel("commands", "handoff.md"),
            "move oldest **RESOLVED** entries to",
        ),
    ),
    Case(
        "orch_backlog_paragraph",
        "orch BACKLOG paragraph -> commands/blueprint.md",
        lambda: _move(
            ORCHESTRATION,
            _rel("commands", "blueprint.md"),
            "one entry per item (a line or a short paragraph)",
        ),
    ),
    Case(
        "orch_plan_vs_todo",
        "orch Plan vs. TODO -> agents/strategist.md",
        lambda: _move(
            ORCHESTRATION,
            _rel("agents", "strategist.md"),
            "`TODO.md` stays thin: status tracking only, references",
        ),
    ),
    Case(
        "orch_global_repository",
        "orch Global Repository -> commands/graduate.md + commands/learn.md",
        lambda: _move_any_home(
            ORCHESTRATION,
            [_rel("commands", "graduate.md"), _rel("commands", "learn.md")],
            "is the Global Registry for rules/skills/standards",
        ),
    ),
    Case(
        "orch_parallel_execution_audit",
        "orch Parallel Execution (/audit --team bullet) -> commands/audit.md",
        lambda: _move(
            ORCHESTRATION,
            _rel("commands", "audit.md"),
            "aggregated into `Reports/<PHASE>-AUDIT_REPORT.md`. Default for full audits; fall back to",
        ),
    ),
    Case(
        "orch_parallel_execution_council",
        "orch Parallel Execution (/council bullet) -> commands/council.md",
        lambda: _move(
            ORCHESTRATION,
            _rel("commands", "council.md"),
            "parallel debate between strategist/coder/auditor to resolve conflict",
        ),
    ),
    Case(
        "orch_severity_scale",
        "orch Severity scale -> agents/auditor.md (status markers table STAYS)",
        lambda: _move(
            ORCHESTRATION,
            _rel("agents", "auditor.md"),
            "Severity: **CRITICAL** (breaking/security/data-loss) → **HIGH** (feature-blocking, major drift)",
        ),
    ),
    Case(
        "orch_findings_protocol",
        "orch Findings Protocol -> commands/handoff.md",
        lambda: _move(
            ORCHESTRATION,
            _rel("commands", "handoff.md"),
            "file technical specifics (variable names, logic traps) to `BACKLOG.md`",
        ),
    ),
    Case(
        # Orchestrator ruling §5a.5: deleting TOKEN-ECONOMICS.md repoints every tracked
        # reference to it, including this pointer -- the old "see TOKEN-ECONOMICS.md" phrase
        # is correctly gone. Anchored on the NEW heading/pointer target the repoint landed
        # on in commands/blueprint.md (which orchestration.md's Findings/Slicing bullet now
        # references) rather than the stale pre-T5 phrase.
        "orch_slicing_pointer",
        "orch Slicing pointer -> repointed to commands/blueprint.md Sec Slicing Thresholds",
        lambda: _dropdup(
            _rel("commands", "blueprint.md"),
            "## Slicing Thresholds",
        ),
    ),
    # --- testing-strategy.md ---
    Case(
        "ts_core_sections",
        "testing-strategy Sec1/Sec2/Sec4/Sec5 -> rules/lang/testing.md",
        lambda: _move_any_glob(
            TESTING_STRATEGY,
            RULES_LANG_DIR,
            "*.md",
            "RED-GREEN-REFACTOR itself is owned by `test-driven-development`; this covers bug-triage.",
        ),
    ),
    Case(
        "ts_required_evidence",
        "testing-strategy Sec6 -> agents/auditor.md",
        lambda: _move(
            TESTING_STRATEGY,
            _rel("agents", "auditor.md"),
            "unit + integration + lint/typecheck — UI: render tests",
        ),
    ),
    # --- security.md ---
    Case(
        "sec_auditor_gate",
        "security Auditor Gate -> agents/auditor.md",
        lambda: _move(
            SECURITY,
            _rel("agents", "auditor.md"),
            "no hardcoded secrets (keys, tokens, connection strings, local paths)",
        ),
    ),
    Case(
        "sec_incident_response",
        "security Incident Response -> agents/auditor.md (1-line pointer stays)",
        lambda: _move(
            SECURITY,
            _rel("agents", "auditor.md"),
            "FREEZE (halt coder/scribe, no writes) → AUDIT (full sweep",
        ),
    ),
    Case(
        "sec_language_floor",
        "security Language-Specific Floor -> per-language rules/lang/*.md",
        lambda: _move_any_glob(
            SECURITY,
            RULES_LANG_DIR,
            "*.md",
            "no secret in `VITE_*`/`import.meta.env`",
        ),
    ),
    Case(
        "sec_hfo2_case_study",
        "security HFO-2 case study -> hooks/README.md (principle stays)",
        lambda: _move(
            SECURITY,
            HOOKS_README,
            "so a content-based rule silently no-oped for",
        ),
    ),
    # --- coding-style.md ---
    Case(
        "cs_python_lang",
        "coding-style Python-Specific -> rules/lang/python.md",
        lambda: _move(
            CODING_STYLE,
            _rel("rules", "lang", "python.md"),
            "100% type coverage, `list[T]`/`T | None`",
        ),
    ),
    Case(
        "cs_typescript_lang",
        "coding-style TypeScript-Specific -> rules/lang/typescript.md",
        lambda: _move(
            CODING_STYLE,
            _rel("rules", "lang", "typescript.md"),
            "strict (`noImplicitAny`, `strictNullChecks`), `unknown` over `any`",
        ),
    ),
    Case(
        "cs_csharp_lang",
        "coding-style C#-Specific -> rules/lang/csharp.md",
        lambda: _move(
            CODING_STYLE,
            _rel("rules", "lang", "csharp.md"),
            ".NET 6+/RhinoCommon, `<Nullable>enable</Nullable>`",
        ),
    ),
    Case(
        "cs_dax_lang",
        "coding-style DAX-Specific -> rules/lang/dax.md",
        lambda: _move(
            CODING_STYLE,
            _rel("rules", "lang", "dax.md"),
            "`VAR` for every intermediate, `DIVIDE` never raw `/`",
        ),
    ),
    # --- model-routing.md ---
    Case(
        # Orchestrator ruling (HR1 fix): the Override column (e.g. "Sonnet for complex
        # architecture docs (ARCH.md)") has no surviving copy in agent frontmatter (which
        # only carries the scalar `model:` binding, not the override condition) -> MOVE.
        "mr_agent_binding",
        "model-routing Agent binding table -> MOVE agents/agents.overview.md (Override column)",
        lambda: _move(
            MODEL_ROUTING,
            AGENTS_OVERVIEW,
            "Sonnet for complex architecture docs (ARCH.md)",
        ),
    ),
    Case(
        "mr_skill_overrides",
        "model-routing Skill overrides -> skills/skills.overview.md",
        lambda: _move(
            MODEL_ROUTING,
            SKILLS_OVERVIEW,
            "`python-rhino-grasshopper` | coder | sonnet (maintain) | Geometric reasoning complexity",
        ),
    ),
    Case(
        "mr_fallback_and_verification",
        "model-routing Fallback Chain + Verification -> scripts/README.md Sec Model-Routing Reference",
        lambda: _move(
            MODEL_ROUTING,
            SCRIPTS_README,
            "This deployment: fallback is `claude-sonnet-5` only",
        ),
    ),
    # --- TOKEN-ECONOMICS.md ---
    Case(
        "te_slicing",
        "TOKEN-ECONOMICS Slicing Thresholds -> commands/blueprint.md",
        lambda: _move(
            TOKEN_ECON,
            _rel("commands", "blueprint.md"),
            "| Task Count | 15+ | Split into 2 slices |",
        ),
    ),
    Case(
        "te_budget",
        "TOKEN-ECONOMICS Token Budgeting -> scripts/README.md",
        lambda: _move(
            TOKEN_ECON,
            SCRIPTS_README,
            "Standard bootstrap (all rules + L1 overviews): ~15,000 tokens",
        ),
    ),
    Case(
        "te_antipatterns",
        "TOKEN-ECONOMICS Anti-Patterns -> agents/concierge.md",
        lambda: _move(
            TOKEN_ECON,
            _rel("agents", "concierge.md"),
            "Eager loading (full skill before checking its Abstract)",
        ),
    ),
    Case(
        # Orchestrator ruling (HR1 fix): only the >60% trigger survived (DROP-DUP'd) in
        # orch Emergency Protocols -- the "phase marked [x]" / "noise from multiple pivots"
        # triggers had no surviving copy -> MOVE the full sentence into agents/concierge.md
        # (source file already deleted in T5; _move tolerates a missing source).
        "te_handoff_triggers",
        "TOKEN-ECONOMICS Handoff Triggers -> MOVE agents/concierge.md (full sentence)",
        lambda: _move(
            TOKEN_ECON,
            _rel("agents", "concierge.md"),
            "noise from multiple pivots",
        ),
    ),
    Case(
        "te_file_absent",
        "TOKEN-ECONOMICS.md (whole file) -- must be absent from rules/common/ after rehoming",
        lambda: _absent_from_rules_common("TOKEN-ECONOMICS.md"),
    ),
    # --- claude-md-standards.md ---
    Case(
        "cms_scope",
        "claude-md-standards (whole file) -> SCOPE via paths: frontmatter",
        lambda: _scope(
            CLAUDE_MD_STANDARDS,
            ["**/CLAUDE.md", "**/CLAUDE-global.md", "**/CLAUDE.local.md", "**/CLAUDE.md.template"],
        ),
    ),
]


@pytest.mark.parametrize("case", CASES, ids=[c.id for c in CASES])
def test_section_map_row(case: Case) -> None:
    """One Plan Sec5 row per test id -- see `case.plan_row` in the failure trace."""
    case.check()
