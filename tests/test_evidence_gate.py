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


# ---------------------------------------------------------------------------
# SGH-1c T12c/T12d — extractTaskNotificationToolUseIds unit contract.
# Both entry shapes, malformed/absent content, dedup, purity, no-throw.
# ---------------------------------------------------------------------------

def _queue_op_entry(tool_use_id: str, task_id: str = "atask1") -> dict:
    """Shape A — queue bookkeeping: top-level `content` string."""
    return {
        "type": "queue-operation",
        "operation": "enqueue",
        "content": (
            f"<task-notification>\n<task-id>{task_id}</task-id>\n"
            f"<tool-use-id>{tool_use_id}</tool-use-id>\n<status>completed</status>\n"
            "<summary>done</summary>\n</task-notification>"
        ),
    }


def _user_message_entry(tool_use_id: str, task_id: str = "atask1") -> dict:
    """Shape B — delivered message: `message.content` is a plain STRING."""
    return {
        "type": "user",
        "message": {
            "role": "user",
            "content": (
                f"<task-notification>\n<task-id>{task_id}</task-id>\n"
                f"<tool-use-id>{tool_use_id}</tool-use-id>\n<status>completed</status>\n"
                "</task-notification>"
            ),
        },
    }


def run_extract_notification_ids(cases: list) -> list:
    result = subprocess.run(
        ["node", str(HELPERS_DIR / "eval_task_notification_ids.js")],
        input=json.dumps(cases),
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        timeout=10,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_extract_notification_ids_reads_queue_operation_shape():
    out = run_extract_notification_ids([[_queue_op_entry("toolu_A")]])
    assert out == [["toolu_A"]]


def test_extract_notification_ids_reads_user_message_shape():
    out = run_extract_notification_ids([[_user_message_entry("toolu_B")]])
    assert out == [["toolu_B"]]


def test_extract_notification_ids_dedups_across_enqueue_and_user_pair():
    # A single real notification appears as BOTH shapes for the same id
    # (probe: queue-operation enqueue, then the delivered type:"user" pair).
    out = run_extract_notification_ids([[_queue_op_entry("toolu_C"), _user_message_entry("toolu_C")]])
    assert out == [["toolu_C"]]


def test_extract_notification_ids_collects_multiple_distinct_ids():
    out = run_extract_notification_ids([[_queue_op_entry("toolu_D"), _queue_op_entry("toolu_E")]])
    assert out == [["toolu_D", "toolu_E"]]


@pytest.mark.parametrize("entries", [
    [],
    [{}],
    [None],
    [{"type": "assistant", "message": {"content": [{"type": "text", "text": "no notification here"}]}}],
    [{"type": "queue-operation", "content": "no marker tag present"}],
    [{"type": "user", "message": {"content": ["not", "a", "string"]}}],
    [{"type": "queue-operation", "content": "<task-notification>no id tag inside</task-notification>"}],
])
def test_extract_notification_ids_malformed_or_absent_content_yields_empty(entries):
    out = run_extract_notification_ids([entries])
    assert out == [[]]


@pytest.mark.parametrize("garbage", [None, "not-an-array", 42, {"not": "an array"}])
def test_extract_notification_ids_never_throws_on_garbage_entries(garbage):
    out = run_extract_notification_ids([garbage])
    assert out == [[]]


def test_extract_notification_ids_ignores_notification_without_matching_dispatch():
    # A background-Bash task-notification is structurally identical — the
    # function itself has no concept of "matching dispatch"; it just extracts
    # every id present. Correlation against dispatched Agent/Task ids is the
    # CALLER's job (task-diff-guard.js's computeBarrier), so this only proves
    # extraction doesn't crash on a notification for an unrelated tool.
    out = run_extract_notification_ids([[_queue_op_entry("toolu_bash_bg")]])
    assert out == [["toolu_bash_bg"]]


def test_extract_notification_ids_is_pure_no_fs_or_date():
    # Structural purity check (SGH-1-Plan.md §11.5 / that file's stated no-I/O
    # contract): the function body must not reference fs or Date at all.
    source = (REPO_ROOT / "hooks" / "lib" / "evidence.js").read_text(encoding="utf-8")
    start = source.index("function extractTaskNotificationToolUseIds")
    end = source.index("\n}\n", start) + len("\n}")
    body = source[start:end]
    assert "fs." not in body
    assert "Date" not in body
    assert "require(" not in body
