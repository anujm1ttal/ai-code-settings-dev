"""Shell smoke tests for hooks/session-boot.js's BACKLOG health check -- BGR-1 T3.

Exercises the real Node subprocess contract (stdin JSON in, SessionStart
additionalContext schema or silence out), matching the pattern established in
test_hooks_smoke.py / test_lh1_hooks.py -- these scripts are invoked by the
Claude Code harness as external processes, not imported.

Hard Rule 1 (BGR-1-TODO.md): the check is context-silent and gates on LINE
COUNT ONLY. Entry counts are advisory text printed only when the check has
already fired on lines -- never a gating signal in their own right. Every run
logs exactly one gate event (decision 'pass' or 'nag') to
Artifacts/.agent/gate_events.jsonl, on both branches, so "fired nowhere" is
distinguishable from "never ran".
"""

import json
import shutil
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
HOOKS_DIR = REPO_ROOT / "hooks"
FIXTURES_DIR = REPO_ROOT / "tests" / "fixtures"

BACKLOG_HEADING = "## BACKLOG Health"
GATE_LOG_REL = Path("Artifacts") / ".agent" / "gate_events.jsonl"


def run_hook(script: str, stdin_payload: str, cwd: Path, hooks_dir: Path = HOOKS_DIR) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["node", str(hooks_dir / script)],
        input=stdin_payload,
        capture_output=True,
        text=True,
        cwd=cwd,
        timeout=10,
    )


def _make_project(tmp_path: Path, *, with_artifacts_dir: bool = True) -> Path:
    """A bare project root with an (optionally empty) Artifacts/ dir -- no other
    state files, so any stdout beyond the BACKLOG check is attributable only
    to this check (isolates the assertion from TODO.md/HANDOFF_BRIEF.md noise
    that a real repo would also inject)."""
    if with_artifacts_dir:
        (tmp_path / "Artifacts").mkdir(parents=True, exist_ok=True)
    return tmp_path


def _write_backlog(project: Path, content: str) -> None:
    (project / "Artifacts").mkdir(parents=True, exist_ok=True)
    (project / "Artifacts" / "BACKLOG.md").write_text(content, encoding="utf-8")


def _gate_log_path(project: Path) -> Path:
    return project / GATE_LOG_REL


def _gate_log_row_count(project: Path) -> int:
    path = _gate_log_path(project)
    if not path.exists():
        return 0
    return len([line for line in path.read_text(encoding="utf-8").splitlines() if line.strip()])


def _run_and_check_gate_event(project: Path, *, expected_decision: str) -> subprocess.CompletedProcess:
    """Runs session-boot.js once and asserts the gate log gained exactly one
    row this run, with the expected decision -- the shared spine of every case
    below (Success metric: "gate_events.jsonl gains exactly 1 row per run")."""
    before = _gate_log_row_count(project)
    payload = json.dumps({"cwd": str(project)})
    result = run_hook("session-boot.js", payload, cwd=project)
    assert result.returncode == 0, f"non-zero exit: stderr={result.stderr!r}"
    after = _gate_log_row_count(project)
    assert after - before == 1, f"expected exactly 1 new gate_events row, got {after - before}"
    last_row = json.loads(_gate_log_path(project).read_text(encoding="utf-8").splitlines()[-1])
    assert last_row["decision"] == expected_decision
    assert last_row["hook"] == "session-boot"
    return result


# ---------------------------------------------------------------------------
# 1. over-cap -- a committed >600-line fixture (line-count breach, not entry-
#    count -- T2's bgr1-over-cap-backlog.md is 88 lines and would NOT trip a
#    line gate; this fixture is BGR-1 T3's own, per the task's fixture warning).
# ---------------------------------------------------------------------------

def test_over_cap_fixture_exceeds_600_lines():
    """Presence control for the fixture itself -- if this drifts under the cap,
    every assertion below about it firing the gate is meaningless."""
    fixture = FIXTURES_DIR / "bgr1-over-cap-lines-backlog.md"
    line_count = len(fixture.read_text(encoding="utf-8").splitlines())
    assert line_count > 600, f"fixture is only {line_count} lines -- no longer over the cap"


def test_over_cap_fires_nag_with_heading(tmp_path: Path):
    project = _make_project(tmp_path)
    fixture_text = (FIXTURES_DIR / "bgr1-over-cap-lines-backlog.md").read_text(encoding="utf-8")
    _write_backlog(project, fixture_text)
    result = _run_and_check_gate_event(project, expected_decision="nag")
    output = json.loads(result.stdout)
    ctx = output["hookSpecificOutput"]["additionalContext"]
    assert ctx.count(BACKLOG_HEADING) == 1


# ---------------------------------------------------------------------------
# 2. compliant -- well within all caps; must be totally silent (Hard Rule 1).
# ---------------------------------------------------------------------------

COMPLIANT_BACKLOG = """# BACKLOG

## `bgr1_compliant-entry_1` -- a small, healthy entry

**Status:** OPEN

## `bgr1_compliant-entry_2` -- another small entry

**Status:** RESOLVED
"""


def test_compliant_is_silent_and_passes(tmp_path: Path):
    project = _make_project(tmp_path)
    _write_backlog(project, COMPLIANT_BACKLOG)
    result = _run_and_check_gate_event(project, expected_decision="pass")
    assert result.stdout.count(BACKLOG_HEADING) == 0
    assert result.stdout.strip() == ""  # No other state files exist -- total silence.


# ---------------------------------------------------------------------------
# 3. absent -- Artifacts/ exists (so gate-log can write), BACKLOG.md does not.
# ---------------------------------------------------------------------------

def test_absent_backlog_passes_silently(tmp_path: Path):
    project = _make_project(tmp_path)
    assert not (project / "Artifacts" / "BACKLOG.md").exists()
    result = _run_and_check_gate_event(project, expected_decision="pass")
    assert result.stdout.count(BACKLOG_HEADING) == 0


# ---------------------------------------------------------------------------
# 4. malformed -- garbled/unusual content, well under the line cap; must not
#    crash the (advisory-only, known-unreliable) entry parser or the gate.
# ---------------------------------------------------------------------------

MALFORMED_BACKLOG = (
    "# BACKLOG\n\n"
    "\x00\x00 binary-ish junk not a real entry\n"
    "## unterminated heading with no body and odd chars: @#$^&*()[]{}\n"
    "**Status:**\n\n"
    "random line with no structure at all whatsoever %%%%%\n"
)


def test_malformed_backlog_fails_open_to_pass(tmp_path: Path):
    project = _make_project(tmp_path)
    _write_backlog(project, MALFORMED_BACKLOG)
    result = _run_and_check_gate_event(project, expected_decision="pass")
    assert result.stdout.count(BACKLOG_HEADING) == 0


# ---------------------------------------------------------------------------
# 5. `###`-authored -- over the line cap, but every heading is `### ` (one hash
#    too many for the `## ` entry parser). Proves the gate fires on raw line
#    count regardless of heading style, independent of the (known-unreliable)
#    entry parser ever recognizing a single entry in the file.
# ---------------------------------------------------------------------------

def _build_hash3_over_cap_backlog() -> str:
    lines = ["# BACKLOG (### -authored fixture)", ""]
    for i in range(1, 160):
        lines.append(f"### `bgr1_hash3-entry_{i}` -- entry authored with an extra hash")
        lines.append("")
        lines.append("**Status:** OPEN")
        lines.append("")
    text = "\n".join(lines)
    assert len(text.splitlines()) > 600
    return text


def test_hash3_authored_over_cap_fires_nag_despite_unrecognized_headings(tmp_path: Path):
    project = _make_project(tmp_path)
    content = _build_hash3_over_cap_backlog()
    _write_backlog(project, content)
    result = _run_and_check_gate_event(project, expected_decision="nag")
    output = json.loads(result.stdout)
    ctx = output["hookSpecificOutput"]["additionalContext"]
    assert ctx.count(BACKLOG_HEADING) == 1
    # The `## ` advisory parser recognizes zero of these `### ` headings -- proof
    # the gate did not, and could not have, relied on entry recognition.
    assert "~0" in ctx


# ---------------------------------------------------------------------------
# 6. category-dump -- many `## N. ... findings` phase-dump headings (the shape
#    that inflates a naive entry count, per the entry-parser defect noted in
#    the task: "one live project reports 2 entries where it holds 121"), but
#    comfortably under the line cap. Proves entry count NEVER gates on its own.
# ---------------------------------------------------------------------------

def _build_category_dump_backlog() -> str:
    lines = ["# BACKLOG (category-dump fixture)", ""]
    for i in range(1, 26):  # 25 headings > MAX_ENTRIES (20), but few lines total.
        lines.append(f"## {i}. Track {i} findings (phase dump)")
        lines.append("- a one-line finding")
    text = "\n".join(lines)
    assert len(text.splitlines()) <= 600
    return text


def test_category_dump_never_gates_on_entry_count_alone(tmp_path: Path):
    project = _make_project(tmp_path)
    content = _build_category_dump_backlog()
    _write_backlog(project, content)
    result = _run_and_check_gate_event(project, expected_decision="pass")
    assert result.stdout.count(BACKLOG_HEADING) == 0


# ---------------------------------------------------------------------------
# Bonus -- malformed hooks/backlog-caps.json must still fail open (design
# constraint: "a malformed backlog-caps.json ... must all leave the hook at
# exit 0"). Exercises the JS fallback path via a copied hooks/ tree so the
# real repo's backlog-caps.json (T2, shared with other tasks this phase) is
# never touched.
# ---------------------------------------------------------------------------

def test_malformed_caps_json_fails_open(tmp_path: Path):
    hooks_copy = tmp_path / "hooks_copy"
    shutil.copytree(HOOKS_DIR, hooks_copy)
    (hooks_copy / "backlog-caps.json").write_text("{not valid json at all", encoding="utf-8")

    project = tmp_path / "project"
    project.mkdir()
    _write_backlog(project, COMPLIANT_BACKLOG)

    before = _gate_log_row_count(project)
    payload = json.dumps({"cwd": str(project)})
    result = run_hook("session-boot.js", payload, cwd=project, hooks_dir=hooks_copy)
    assert result.returncode == 0, f"stderr={result.stderr!r}"
    assert result.stdout.count(BACKLOG_HEADING) == 0
    after = _gate_log_row_count(project)
    assert after - before == 1
