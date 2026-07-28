"""Shell smoke tests for the IGH-1 mechanical guards — TODO T2-T3.

Exercises T2 (guard-commands.js source-redirect deny) and T3
(guard-shared-state.js Stop hook) via the real Node subprocess contract,
matching the pattern in test_hooks_smoke.py / test_lh1_hooks.py.
"""

import json
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
HOOKS_DIR = REPO_ROOT / "hooks"


def run_hook(script: str, stdin_payload: str, cwd: Path = REPO_ROOT) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["node", str(HOOKS_DIR / script)],
        input=stdin_payload,
        capture_output=True,
        text=True,
        cwd=cwd,
        timeout=10,
    )


def run_guard_commands(command: str) -> subprocess.CompletedProcess:
    return run_hook("guard-commands.js", json.dumps({"tool_input": {"command": command}}))


def assert_denied(command: str, expect_reason: str = "Shell redirect") -> None:
    result = run_guard_commands(command)
    assert result.returncode == 0, f"hook must exit 0 even when denying: {result.stderr}"
    output = json.loads(result.stdout)
    hso = output["hookSpecificOutput"]
    assert hso["permissionDecision"] == "deny", f"expected deny for: {command}"
    assert expect_reason in hso["permissionDecisionReason"]


def assert_allowed(command: str) -> None:
    result = run_guard_commands(command)
    assert result.returncode == 0, f"hook must exit 0: {result.stderr}"
    assert result.stdout.strip() == "", (
        f"expected NO deny for: {command}\ngot: {result.stdout}"
    )


# ---------------------------------------------------------------------------
# T2 — source-redirect deny
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "command",
    [
        'echo "print(1)" > scripts/thing.py',
        "cat template.md >> README.md",
        "python gen.py > hooks/generated.js",
        "curl https://example.com/x > package.json",
        "cat > config.yaml <<'EOF'",
        'echo "x" >settings.json',
        "python -c 'print(1)' 2> error_log.py",
    ],
)
def test_redirect_into_source_is_denied(command):
    assert_denied(command)


@pytest.mark.parametrize(
    "command",
    [
        # HR1 — the evidence protocol (testing-strategy.md §3) MUST survive.
        "python -m pytest tests/ -q > Artifacts/Temp/igh1_t2_pytest.txt 2>&1",
        "bash scripts/deploy.sh > Artifacts/Evidence/IGH-1/deploy.txt 2>&1",
        # HR1 — even a source EXTENSION is fine inside the evidence dirs.
        "python gen.py > Artifacts/Temp/scratch_probe.py",
        "cat a.md > Artifacts/Evidence/IGH-1/snapshot.md",
        # Non-source targets are none of this guard's business.
        "python -m pytest -q > results.txt",
        "ls > /dev/null",
        # fd duplication must stay inert.
        "python -m pytest tests/ 2>&1",
        "make build >&2",
    ],
)
def test_allowlisted_and_nonsource_redirects_pass(command):
    assert_allowed(command)


@pytest.mark.parametrize(
    "command",
    [
        # False-positive controls: arrows and comparisons are not redirects.
        'git commit -m "refactor: rename a.py -> b.py"',
        'git commit -m "chore: migrate config.json => config.yaml"',
        "python -c 'assert version >= 3.12'",
        # A heredoc that redirects nowhere (standards.md commit pattern).
        "git commit -m @'\nfix: update loader.py call sites\n'@",
        # Reading a source file is never a write.
        "cat hooks/guard-commands.js",
        "python -m pytest tests/test_igh_guards.py",
    ],
)
def test_non_redirect_source_mentions_pass(command):
    assert_allowed(command)


@pytest.mark.parametrize(
    "command",
    [
        # PUB-2: an angle-bracket placeholder's closing `>` is prose, not a
        # redirect operator. Observed 2026-07-28 — a commit message describing
        # this hook was denied by this hook, the second such self-trip.
        'git commit -m "fix: template hardcoded C:/Users/<author>/.claude/hooks/*.js"',
        'git commit -m "docs: settings live at C:/Users/<you>/.claude/settings.json"',
        'git commit -m "evidence lands in Artifacts/Temp/<phase>_<step>.py"',
        'echo "see <VERSION_NUMBER>/notes.md for details"',
    ],
)
def test_angle_bracket_placeholders_are_not_redirects(command):
    assert_allowed(command)


@pytest.mark.parametrize(
    "command",
    [
        # PUB-2 bypass controls: stripping placeholders must not blunt the
        # guard. The space-free form in particular is what the rejected
        # `\w`-lookbehind fix would have silently stopped catching.
        "echo x>module.py",
        "echo x><placeholder>module.py",
        "cat > <name>/config.yaml",
    ],
)
def test_placeholder_stripping_opens_no_bypass(command):
    assert_denied(command)


@pytest.mark.parametrize(
    "command",
    [
        "Set-Content -Path hooks/guard.js -Value $x",
        "$out | Out-File -FilePath scripts/model_router.py",
        "Add-Content rules/common/coding-style.md 'text'",
    ],
)
def test_powershell_write_cmdlets_into_source_are_denied(command):
    assert_denied(command)


@pytest.mark.parametrize(
    "command",
    [
        # A traversal segment carries the allowlisted prefix back out of Temp/.
        "echo x > Artifacts/Temp/../../scripts/thing.py",
        "echo x > Artifacts/Evidence/../../../hooks/guard.js",
        "echo x > Artifacts\\Temp\\..\\..\\scripts\\thing.py",
    ],
)
def test_allowlist_cannot_be_escaped_by_traversal(command):
    """Regression: found by T5 adversarial probe, 2026-07-26."""
    assert_denied(command)


def test_powershell_write_cmdlet_into_temp_passes():
    assert_allowed("$out | Out-File -FilePath Artifacts/Temp/igh1_probe.txt")


@pytest.mark.parametrize(
    "command",
    [
        # Merely NAMING a write cmdlet must not arm the guard against unrelated
        # source filenames elsewhere in the command.
        # Regression: this guard denied the commit message describing it, 2026-07-26.
        'git commit -m "docs: cover Set-Content/Out-File in hooks/guard-commands.js"',
        "grep -rn 'Add-Content' hooks/README.md",
        'echo "use Out-File instead of redirect" # see tests/test_igh_guards.py',
        # Writing somewhere harmless while a source file is named elsewhere.
        "Set-Content -Path Artifacts/Temp/note.txt -Value 'edit hooks/guard-commands.js'",
    ],
)
def test_naming_a_write_cmdlet_does_not_arm_the_guard(command):
    assert_allowed(command)


def test_existing_denies_still_fire():
    """T2 must not displace the pre-existing deny list."""
    assert_denied("git reset --hard HEAD~3", expect_reason="discards uncommitted changes")
    assert_denied(
        'git commit -m "feat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>"',
        expect_reason="AI attribution trailer",
    )


def test_guard_commands_fails_open_on_malformed_input():
    result = run_hook("guard-commands.js", "{not json")
    assert result.returncode == 0
    assert result.stdout.strip() == ""


# ---------------------------------------------------------------------------
# T3 — shared-state Stop hook
# ---------------------------------------------------------------------------

STDOUT_EDIT = {"file_path": "scripts/thing.py", "content": "sys.stdout = TextIOWrapper(buf)"}
BENIGN_EDIT = {"file_path": "scripts/thing.py", "content": "def add(a, b):\n    return a + b"}

FULL_SUITE = "python -m pytest tests/ -q"
SUBSET_RUN = "python -m pytest tests/test_backlog_audit.py -q"


def _tool_use(name: str, tool_input: dict) -> str:
    return json.dumps({
        "type": "assistant",
        "message": {"content": [{"type": "tool_use", "id": "t1", "name": name, "input": tool_input}]},
    })


def write_transcript(tmp_path: Path, steps: list[tuple[str, dict]]) -> Path:
    transcript = tmp_path / "transcript.jsonl"
    transcript.write_text("\n".join(_tool_use(name, inp) for name, inp in steps), encoding="utf-8")
    return transcript


def run_shared_state(tmp_path: Path, steps: list[tuple[str, dict]], **extra) -> subprocess.CompletedProcess:
    payload = json.dumps({"transcript_path": str(write_transcript(tmp_path, steps)), **extra})
    return run_hook("guard-shared-state.js", payload)


def test_shared_state_fires_on_subset_only_run(tmp_path: Path):
    result = run_shared_state(tmp_path, [("Write", STDOUT_EDIT), ("Bash", {"command": SUBSET_RUN})])
    assert result.returncode == 0
    assert result.stdout.strip() != "", f"should have fired: stderr={result.stderr!r}"
    output = json.loads(result.stdout)
    hso = output["hookSpecificOutput"]
    assert hso["hookEventName"] == "Stop"
    assert "SHARED-STATE GUARD" in hso["additionalContext"]
    # Branch B invariant — feedback only, never a block (Hard Rule 2).
    assert "permissionDecision" not in output
    assert "decision" not in output
    assert "permissionDecision" not in hso


def test_shared_state_fires_when_no_test_run_at_all(tmp_path: Path):
    result = run_shared_state(tmp_path, [("Write", STDOUT_EDIT)])
    assert result.stdout.strip() != ""


def test_shared_state_fires_when_full_suite_ran_before_the_edit(tmp_path: Path):
    """Ordering matters — a full run that predates the edit proves nothing."""
    result = run_shared_state(tmp_path, [("Bash", {"command": FULL_SUITE}), ("Write", STDOUT_EDIT)])
    assert result.stdout.strip() != ""


@pytest.mark.parametrize(
    "command",
    [FULL_SUITE, "pytest", "pytest -q", "bash scripts/deploy.sh"],
)
def test_shared_state_silent_on_full_suite_run(tmp_path: Path, command: str):
    result = run_shared_state(tmp_path, [("Write", STDOUT_EDIT), ("Bash", {"command": command})])
    assert result.returncode == 0
    assert result.stdout.strip() == "", f"should have stayed silent: {result.stdout!r}"


@pytest.mark.parametrize(
    "command",
    [SUBSET_RUN, "pytest tests/test_x.py::test_one", "pytest -k backlog"],
)
def test_subset_selectors_do_not_count_as_full_suite(tmp_path: Path, command: str):
    result = run_shared_state(tmp_path, [("Write", STDOUT_EDIT), ("Bash", {"command": command})])
    assert result.stdout.strip() != "", f"{command} is a subset run and must not silence the guard"


@pytest.mark.parametrize(
    "tool_input",
    [
        BENIGN_EDIT,
        {"file_path": "a.py", "new_string": "return sorted(items)"},
    ],
)
def test_shared_state_silent_when_no_shared_state_touched(tmp_path: Path, tool_input: dict):
    result = run_shared_state(tmp_path, [("Edit", tool_input), ("Bash", {"command": SUBSET_RUN})])
    assert result.stdout.strip() == ""


@pytest.mark.parametrize(
    "new_string",
    [
        "os.environ['X'] = '1'",
        "logging.basicConfig(level=logging.DEBUG)",
        "sys.stderr = open(devnull, 'w')",
        "stream.reconfigure(encoding='utf-8')",
    ],
)
def test_each_shared_state_pattern_is_detected(tmp_path: Path, new_string: str):
    steps = [("Edit", {"file_path": "a.py", "new_string": new_string}), ("Bash", {"command": SUBSET_RUN})]
    assert run_shared_state(tmp_path, steps).stdout.strip() != ""


def test_shared_state_detects_multiedit_payloads(tmp_path: Path):
    steps = [
        ("MultiEdit", {"file_path": "a.py", "edits": [{"new_string": "x = 1"}, {"new_string": "sys.stdout = buf"}]}),
        ("Bash", {"command": SUBSET_RUN}),
    ]
    assert run_shared_state(tmp_path, steps).stdout.strip() != ""


def test_shared_state_respects_stop_hook_active(tmp_path: Path):
    result = run_shared_state(tmp_path, [("Write", STDOUT_EDIT)], stop_hook_active=True)
    assert result.stdout.strip() == ""


@pytest.mark.parametrize("payload", ["{not json", "", json.dumps({"transcript_path": "/nonexistent/x.jsonl"})])
def test_shared_state_fails_open(payload: str):
    result = run_hook("guard-shared-state.js", payload)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_shared_state_skips_malformed_jsonl_lines(tmp_path: Path):
    transcript = tmp_path / "t.jsonl"
    transcript.write_text(
        "{ broken\n" + _tool_use("Write", STDOUT_EDIT) + "\nnot-json\n", encoding="utf-8"
    )
    result = run_hook("guard-shared-state.js", json.dumps({"transcript_path": str(transcript)}))
    assert result.returncode == 0
    assert result.stdout.strip() != "", "valid lines must still be read around malformed ones"
