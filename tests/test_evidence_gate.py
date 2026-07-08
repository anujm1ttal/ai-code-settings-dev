"""Shell smoke tests for hooks/evidence-gate.js — LH-2 T2/T3.

Exercises the real Node subprocess contract against the six fixture
transcripts under tests/fixtures/lh2/ (fire/silent spec, LH-2-Plan.md §T3)
and proves the Branch B invariant: additionalContext-only, NEVER a
deny/permissionDecision field (LH-2-Plan.md Hard Rule 2 / Success Metric M3).
"""

import json
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
HOOKS_DIR = REPO_ROOT / "hooks"
FIXTURES_DIR = REPO_ROOT / "tests" / "fixtures" / "lh2"
HELPERS_DIR = REPO_ROOT / "tests" / "helpers"

FIRES = ["unevidenced-done.jsonl", "stale-evidence.jsonl"]
SILENT = [
    "evidenced-done.jsonl", "doc-only.jsonl", "conversational.jsonl", "handoff.jsonl",
    # Auditor 1st-rejection regressions: quoted literal / hyphen-compound false positives.
    "quoted-literal-done.jsonl", "hyphen-compound-fixed.jsonl",
]


def run_hook(script: str, stdin_payload: str, cwd: Path = REPO_ROOT) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["node", str(HOOKS_DIR / script)],
        input=stdin_payload,
        capture_output=True,
        text=True,
        cwd=cwd,
        timeout=10,
    )


def run_gate_on_fixture(fixture_name: str, **extra_payload) -> subprocess.CompletedProcess:
    payload = json.dumps({"transcript_path": str(FIXTURES_DIR / fixture_name), **extra_payload})
    return run_hook("evidence-gate.js", payload)


def _assert_no_deny_field(output: dict) -> None:
    assert "permissionDecision" not in output
    assert "decision" not in output
    assert "permissionDecision" not in output.get("hookSpecificOutput", {})


@pytest.mark.parametrize("fixture_name", FIRES)
def test_evidence_gate_fires_on_unevidenced_claim(fixture_name: str):
    result = run_gate_on_fixture(fixture_name)
    assert result.returncode == 0
    assert result.stdout.strip() != "", f"{fixture_name} should have fired: stderr={result.stderr!r}"
    output = json.loads(result.stdout)
    hso = output["hookSpecificOutput"]
    assert hso["hookEventName"] == "Stop"
    assert "IRON LAW" in hso["additionalContext"]
    _assert_no_deny_field(output)


@pytest.mark.parametrize("fixture_name", SILENT)
def test_evidence_gate_silent_on_evidenced_or_exempt_sessions(fixture_name: str):
    result = run_gate_on_fixture(fixture_name)
    assert result.returncode == 0
    assert result.stdout.strip() == "", f"{fixture_name} should have stayed silent: stdout={result.stdout!r}"


def test_evidence_gate_respects_stop_hook_active():
    # An otherwise-firing fixture must stay silent when the harness signals a retry chain.
    result = run_gate_on_fixture("unevidenced-done.jsonl", stop_hook_active=True)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_evidence_gate_never_emits_deny_field_across_all_fixtures():
    # M3 — structural proof across every fixture, not just the firing ones.
    for fixture_name in FIRES + SILENT:
        result = run_gate_on_fixture(fixture_name)
        assert result.returncode == 0
        if result.stdout.strip():
            _assert_no_deny_field(json.loads(result.stdout))


def test_evidence_gate_missing_transcript_fails_open_silently():
    payload = json.dumps({"transcript_path": str(FIXTURES_DIR / "does-not-exist.jsonl")})
    result = run_hook("evidence-gate.js", payload)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_evidence_gate_unreadable_transcript_path_fails_open(tmp_path: Path):
    # A directory at transcript_path forces fs.readFileSync to throw (EISDIR)
    # — proves the transcript-read failure path stays fail-open.
    directory_as_path = tmp_path / "not-a-file"
    directory_as_path.mkdir()
    payload = json.dumps({"transcript_path": str(directory_as_path)})
    result = run_hook("evidence-gate.js", payload)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_evidence_gate_malformed_jsonl_lines_are_skipped_defensively(tmp_path: Path):
    transcript = tmp_path / "transcript.jsonl"
    transcript.write_text(
        "not valid json {{{\n"
        + Path(FIXTURES_DIR / "unevidenced-done.jsonl").read_text()
    )
    payload = json.dumps({"transcript_path": str(transcript)})
    result = run_hook("evidence-gate.js", payload)
    assert result.returncode == 0
    assert result.stdout.strip() != ""  # still fires on the valid lines that follow


# ---------------------------------------------------------------------------
# Unit-level claim-lexicon contract: negations and questions MUST NOT match.
# ---------------------------------------------------------------------------

CLAIM_CASES = [
    ("This is not done yet.", False),
    ("The fix is almost done.", False),
    ("It isn't fixed.", False),
    ("Is it done?", False),
    ("Are we done yet?", False),
    ("The bug is fixed.", True),
    ("All tests pass.", True),
    ("It works now.", True),
    ("Fixed the crash and it's finished.", True),
    # Auditor 1st-rejection findings (HIGH): quoted literal, hyphen compound.
    ('I added a debug line that prints "done" to the console.', False),
    ("I switched the allocator to use a fixed-size buffer.", False),
    # Side-effect regression: skip-in-place must not hide a genuine, unquoted
    # claim word elsewhere in the same sentence (skip-in-place vs strip-and-
    # rematch — the auditor's flagged pitfall of the strip approach).
    ('The function returns "done" when complete.', True),
]


def test_completion_claim_lexicon_excludes_negations_and_questions():
    texts = [text for text, _ in CLAIM_CASES]
    expected = [matched for _, matched in CLAIM_CASES]
    result = subprocess.run(
        ["node", str(HELPERS_DIR / "eval_completion_claim.js")],
        input=json.dumps(texts),
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        timeout=10,
    )
    assert result.returncode == 0, result.stderr
    actual = json.loads(result.stdout)
    assert actual == expected, f"mismatch for {list(zip(texts, actual))}"
