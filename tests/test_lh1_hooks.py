"""Shell smoke tests for the LH-1 hook changes — TODO T1-T4.

Exercises T1 (auto-lint.js loop-closing directive), T2 (guard-paths.js
scratch-gate), T3 (guard-commands.js commit-trailer deny), and T4
(nudge-handoff.js Stop hook) via the real Node subprocess contract, matching
the pattern in test_hooks_smoke.py.
"""

import json
import os
import shutil
import subprocess
import sys
import uuid
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
HOOKS_DIR = REPO_ROOT / "hooks"


def run_hook(script: str, stdin_payload: str, cwd: Path = REPO_ROOT, env: dict | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["node", str(HOOKS_DIR / script)],
        input=stdin_payload,
        capture_output=True,
        text=True,
        cwd=cwd,
        env=env,
        timeout=10,
    )


# ---------------------------------------------------------------------------
# T1 — auto-lint.js loop-closing directive
# ---------------------------------------------------------------------------

def _fake_ruff_env(fake_dir: Path, exit_code: int, stdout_line: str = "") -> dict:
    """Build an env where `ruff` resolves to a controllable fake.

    Windows refuses to spawn .cmd/.bat via execFileSync without shell:true
    (Node's CVE-2024-27980 mitigation) — a batch-file PATH shim does not work
    against auto-lint.js's execFileSync(cmd, args) call. Instead: copy the
    real node.exe to `ruff.exe` (a real PE, spawns fine) and use NODE_OPTIONS
    to preload an interceptor that only fires for the nested `ruff` process
    (identified by argv[1] NOT ending in auto-lint.js) so the outer
    `node hooks/auto-lint.js` invocation under test is unaffected.
    """
    if sys.platform == "win32":
        node_path = shutil.which("node")
        assert node_path, "node must be on PATH to build the fake ruff binary"
        fake_bin = fake_dir / "ruff.exe"
        shutil.copy(node_path, fake_bin)

        intercept_js = fake_dir / "fake_ruff_intercept.js"
        intercept_js.write_text(
            "const entry = process.argv[1] || '';\n"
            "if (!entry.endsWith('auto-lint.js')) {\n"
            "  if (process.env.FAKE_RUFF_STDOUT) process.stdout.write(process.env.FAKE_RUFF_STDOUT);\n"
            "  process.exit(parseInt(process.env.FAKE_RUFF_EXIT || '0', 10));\n"
            "}\n"
        )

        env = dict(os.environ)
        path_key = next((k for k in env if k.upper() == "PATH"), "PATH")
        env[path_key] = str(fake_dir) + os.pathsep + env.get(path_key, "")
        # NODE_OPTIONS tokenizing mangles backslashes — use forward slashes.
        env["NODE_OPTIONS"] = f'--require "{intercept_js.as_posix()}"'
        env["FAKE_RUFF_EXIT"] = str(exit_code)
        if stdout_line:
            env["FAKE_RUFF_STDOUT"] = stdout_line + "\n"
        return env

    script = fake_dir / "ruff"
    body = "#!/bin/sh\n"
    if stdout_line:
        body += f'echo "{stdout_line}"\n'
    body += f"exit {exit_code}\n"
    script.write_text(body)
    script.chmod(0o755)
    env = dict(os.environ)
    path_key = next((k for k in env if k.upper() == "PATH"), "PATH")
    env[path_key] = str(fake_dir) + os.pathsep + env.get(path_key, "")
    return env


def test_auto_lint_seeded_violation_injects_directive(tmp_path: Path):
    env = _fake_ruff_env(tmp_path, exit_code=1, stdout_line="test.py:1:1: F401 'os' imported but unused")
    payload = json.dumps({"tool_input": {"file_path": "test.py"}, "cwd": str(tmp_path)})
    result = run_hook("auto-lint.js", payload, env=env)
    assert result.returncode == 0
    output = json.loads(result.stdout)
    ctx = output["hookSpecificOutput"]["additionalContext"]
    assert "F401" in ctx
    assert "1 issue" in ctx
    assert "fix before proceeding" in ctx.lower()


def test_auto_lint_clean_file_no_injection(tmp_path: Path):
    env = _fake_ruff_env(tmp_path, exit_code=0)
    payload = json.dumps({"tool_input": {"file_path": "test.py"}, "cwd": str(tmp_path)})
    result = run_hook("auto-lint.js", payload, env=env)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_auto_lint_ruff_absent_fails_open_silently(tmp_path: Path):
    # No fake ruff on PATH, and this dev machine has none installed either.
    payload = json.dumps({"tool_input": {"file_path": "test.py"}, "cwd": str(tmp_path)})
    result = run_hook("auto-lint.js", payload)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


# ---------------------------------------------------------------------------
# T2 — guard-paths.js scratch-gate
# ---------------------------------------------------------------------------

def test_guard_paths_denies_shadow_todo():
    payload = json.dumps({"tool_input": {"file_path": "C:/Users/tester/.claude/projects/shadow-proj/TODO.md"}})
    result = run_hook("guard-paths.js", payload)
    assert result.returncode == 0
    hso = json.loads(result.stdout)["hookSpecificOutput"]
    assert hso["permissionDecision"] == "deny"
    assert "Artifacts/" in hso["permissionDecisionReason"]


def test_guard_paths_allows_memory_write_under_shadow_path():
    payload = json.dumps({"tool_input": {"file_path": "C:/Users/tester/.claude/projects/shadow-proj/memory/MEMORY.md"}})
    result = run_hook("guard-paths.js", payload)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_guard_paths_allows_state_basename_under_memory_dir():
    # State basename (todo.md) — but under the allowlisted memory/ segment.
    payload = json.dumps({"tool_input": {"file_path": "C:/Users/tester/.claude/projects/shadow-proj/memory/todo.md"}})
    result = run_hook("guard-paths.js", payload)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_guard_paths_allows_tool_results_write_under_shadow_path():
    payload = json.dumps({"tool_input": {"file_path": "C:/Users/tester/.claude/projects/shadow-proj/tool-results/backlog.md"}})
    result = run_hook("guard-paths.js", payload)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_guard_paths_denies_notebook_edit_shadow_state_file():
    payload = json.dumps({"tool_input": {"notebook_path": "C:/Users/tester/.claude/projects/shadow-proj/DECISION_LOG.md"}})
    result = run_hook("guard-paths.js", payload)
    assert result.returncode == 0
    hso = json.loads(result.stdout)["hookSpecificOutput"]
    assert hso["permissionDecision"] == "deny"


def test_guard_paths_denies_bare_scratch_segment():
    payload = json.dumps({"tool_input": {"file_path": "C:/tmp/scratch/analysis.py"}})
    result = run_hook("guard-paths.js", payload)
    assert result.returncode == 0
    hso = json.loads(result.stdout)["hookSpecificOutput"]
    assert hso["permissionDecision"] == "deny"
    assert "Artifacts/Temp" in hso["permissionDecisionReason"]


def test_guard_paths_allows_harness_scratchpad_segment():
    payload = json.dumps({"tool_input": {"file_path": "C:/Users/tester/AppData/Local/Temp/claude/session/scratchpad/notes.py"}})
    result = run_hook("guard-paths.js", payload)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_guard_paths_allows_shadow_path_non_state_file():
    # Not a known state basename — the shadow tree itself is otherwise legitimate.
    payload = json.dumps({"tool_input": {"file_path": "C:/Users/tester/.claude/projects/shadow-proj/notes.md"}})
    result = run_hook("guard-paths.js", payload)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_guard_paths_denies_windows_backslash_shadow_path():
    # Windows-native backslash path (no forward-slash normalization by the
    # caller) — locks isBlocked()'s own backslash-to-slash normalization.
    payload = json.dumps({"tool_input": {"file_path": "C:\\Users\\tester\\.claude\\projects\\shadow-proj\\TODO.md"}})
    result = run_hook("guard-paths.js", payload)
    assert result.returncode == 0
    hso = json.loads(result.stdout)["hookSpecificOutput"]
    assert hso["permissionDecision"] == "deny"
    assert "Artifacts/" in hso["permissionDecisionReason"]


# ---------------------------------------------------------------------------
# T3 — guard-commands.js commit-trailer deny
# ---------------------------------------------------------------------------

BASH_HEREDOC_TRAILER = (
    'git commit -m "$(cat <<\'EOF\'\n'
    'Fix bug\n\n'
    'Generated with [Claude Code](https://claude.com/claude-code)\n\n'
    'Co-Authored-By: Claude <noreply@anthropic.com>\n'
    'EOF\n'
    ')"'
)

PWSH_HERESTRING_TRAILER = (
    'git commit -m @"\n'
    'Fix bug\n\n'
    'Co-Authored-By: Claude <noreply@anthropic.com>\n'
    '"@'
)


def test_guard_commands_denies_bash_heredoc_trailer():
    payload = json.dumps({"tool_input": {"command": BASH_HEREDOC_TRAILER}})
    result = run_hook("guard-commands.js", payload)
    assert result.returncode == 0
    hso = json.loads(result.stdout)["hookSpecificOutput"]
    assert hso["permissionDecision"] == "deny"
    assert "trailer" in hso["permissionDecisionReason"].lower()


def test_guard_commands_denies_powershell_herestring_trailer():
    payload = json.dumps({"tool_input": {"command": PWSH_HERESTRING_TRAILER}})
    result = run_hook("guard-commands.js", payload)
    assert result.returncode == 0
    hso = json.loads(result.stdout)["hookSpecificOutput"]
    assert hso["permissionDecision"] == "deny"


def test_guard_commands_allows_trailer_free_commit():
    payload = json.dumps({"tool_input": {"command": 'git commit -m "Fix login bug"'}})
    result = run_hook("guard-commands.js", payload)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_guard_commands_allows_prose_mentioning_claude():
    payload = json.dumps({"tool_input": {"command": 'git commit -m "Investigate issue reported by Claude review bot"'}})
    result = run_hook("guard-commands.js", payload)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_guard_commands_allows_git_log_grep_of_trailer_text():
    payload = json.dumps({"tool_input": {"command": 'git log --oneline --grep="Co-Authored-By: Claude"'}})
    result = run_hook("guard-commands.js", payload)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_guard_commands_allows_piped_git_log_grep_of_trailer_text():
    # `git log | grep ...` never contains "git commit" — must not fire.
    payload = json.dumps({"tool_input": {"command": 'git log | grep "Co-Authored-By: Claude"'}})
    result = run_hook("guard-commands.js", payload)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_guard_commands_denies_trailer_before_git_commit():
    # F1 regression: the trailer text lands in a file BEFORE `git commit` runs
    # — order-independent detection must still catch it (a single positional
    # regex `git commit ... trailer` does not).
    payload = json.dumps({
        "tool_input": {"command": 'echo "Co-Authored-By: Claude" >> msg.txt && git commit -F msg.txt'},
    })
    result = run_hook("guard-commands.js", payload)
    assert result.returncode == 0
    hso = json.loads(result.stdout)["hookSpecificOutput"]
    assert hso["permissionDecision"] == "deny"
    assert "trailer" in hso["permissionDecisionReason"].lower()


# ---------------------------------------------------------------------------
# T4 — nudge-handoff.js Stop hook
# ---------------------------------------------------------------------------

def _init_git_repo(repo_dir: Path, dirty: bool) -> None:
    subprocess.run(["git", "init", "-q"], cwd=repo_dir, check=True)
    if dirty:
        (repo_dir / "untracked.txt").write_text("scratch content")


def _marker_path(session_id: str) -> Path:
    import tempfile
    return Path(tempfile.gettempdir()) / "claude-nudge-handoff" / f"{session_id}.marker"


@pytest.fixture
def nudge_session():
    session_id = str(uuid.uuid4())
    yield session_id
    marker = _marker_path(session_id)
    if marker.exists():
        marker.unlink()


def test_nudge_handoff_dirty_tree_nudges(tmp_path: Path, nudge_session: str):
    _init_git_repo(tmp_path, dirty=True)
    payload = json.dumps({"cwd": str(tmp_path), "session_id": nudge_session})
    result = run_hook("nudge-handoff.js", payload)
    assert result.returncode == 0
    hso = json.loads(result.stdout)["hookSpecificOutput"]
    assert hso["hookEventName"] == "Stop"
    assert "handoff" in hso["additionalContext"].lower()
    assert "permissionDecision" not in hso  # Nudge only — never a deny field


def test_nudge_handoff_clean_tree_silent(tmp_path: Path, nudge_session: str):
    _init_git_repo(tmp_path, dirty=False)
    payload = json.dumps({"cwd": str(tmp_path), "session_id": nudge_session})
    result = run_hook("nudge-handoff.js", payload)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_nudge_handoff_rate_limited_second_stop_silent(tmp_path: Path, nudge_session: str):
    _init_git_repo(tmp_path, dirty=True)
    payload = json.dumps({"cwd": str(tmp_path), "session_id": nudge_session})
    first = run_hook("nudge-handoff.js", payload)
    assert first.stdout.strip() != ""
    second = run_hook("nudge-handoff.js", payload)
    assert second.returncode == 0
    assert second.stdout.strip() == ""


def test_nudge_handoff_recent_handoff_suppresses_nudge(tmp_path: Path, nudge_session: str):
    _init_git_repo(tmp_path, dirty=True)
    transcript = tmp_path / "transcript.jsonl"
    transcript.write_text('{"role":"user","content":"/handoff"}\n')
    payload = json.dumps({"cwd": str(tmp_path), "session_id": nudge_session, "transcript_path": str(transcript)})
    result = run_hook("nudge-handoff.js", payload)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_nudge_handoff_non_git_cwd_fails_open_silently(tmp_path: Path, nudge_session: str):
    # No git repo at all — isGitDirty must catch the failure and stay silent.
    payload = json.dumps({"cwd": str(tmp_path), "session_id": nudge_session})
    result = run_hook("nudge-handoff.js", payload)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


# ---------------------------------------------------------------------------
# PUB-2 — nested Artifacts/ state repo (private-state-repo arrangement)
# ---------------------------------------------------------------------------

def _commit_outer(repo_dir: Path, *, ignore_artifacts: bool) -> None:
    """Leave the OUTER repo with a clean tree, mirroring the real arrangement
    where Artifacts/ is gitignored by the public repo. Without this the outer
    dirty-tree nudge fires on the untracked Artifacts/ and masks what these
    tests are actually asserting."""
    if ignore_artifacts:
        (repo_dir / ".gitignore").write_text("Artifacts/\n")
    subprocess.run(["git", "add", "-A"], cwd=repo_dir, check=True, capture_output=True)
    subprocess.run(
        ["git", "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "base"],
        cwd=repo_dir, check=True, capture_output=True,
    )


def _init_state_repo(repo_dir: Path, *, dirty: bool, with_upstream: bool) -> None:
    """Build <repo>/Artifacts as its own git repo, optionally with an upstream."""
    artifacts = repo_dir / "Artifacts"
    artifacts.mkdir(parents=True, exist_ok=True)
    (artifacts / "TODO.md").write_text("- [ ] task\n")
    run = lambda *a: subprocess.run(a, cwd=artifacts, check=True,
                                    capture_output=True)
    run("git", "init", "-q", "-b", "main")
    run("git", "add", "-A")
    run("git", "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "init")
    if with_upstream:
        bare = repo_dir / "state-remote.git"
        subprocess.run(["git", "init", "-q", "--bare", str(bare)], check=True,
                       capture_output=True)
        run("git", "remote", "add", "origin", str(bare))
        run("git", "push", "-q", "-u", "origin", "main")
    if dirty:
        (artifacts / "DECISION_LOG.md").write_text("new decision\n")


def test_nudge_state_repo_dirty_warns_even_when_outer_tree_clean(
    tmp_path: Path, nudge_session: str
):
    """The core risk: notes written, no code touched. Outer repo is clean, so
    the pre-existing dirty-tree check sees nothing to nudge about."""
    _init_git_repo(tmp_path, dirty=False)
    _init_state_repo(tmp_path, dirty=True, with_upstream=True)
    _commit_outer(tmp_path, ignore_artifacts=True)
    payload = json.dumps({"cwd": str(tmp_path), "session_id": nudge_session})
    result = run_hook("nudge-handoff.js", payload)
    assert result.returncode == 0
    hso = json.loads(result.stdout)["hookSpecificOutput"]
    assert "Artifacts" in hso["additionalContext"]
    assert "permissionDecision" not in hso  # Nudge only — never a deny.


def test_nudge_state_repo_unpushed_commits_warn(tmp_path: Path, nudge_session: str):
    _init_git_repo(tmp_path, dirty=False)
    _init_state_repo(tmp_path, dirty=False, with_upstream=True)
    _commit_outer(tmp_path, ignore_artifacts=True)
    artifacts = tmp_path / "Artifacts"
    (artifacts / "BACKLOG.md").write_text("item\n")
    subprocess.run(["git", "add", "-A"], cwd=artifacts, check=True, capture_output=True)
    subprocess.run(
        ["git", "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "wip"],
        cwd=artifacts, check=True, capture_output=True,
    )
    payload = json.dumps({"cwd": str(tmp_path), "session_id": nudge_session})
    result = run_hook("nudge-handoff.js", payload)
    assert "Artifacts" in json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"]


def test_nudge_state_repo_no_upstream_warns(tmp_path: Path, nudge_session: str):
    """No remote configured means there is nothing to be backed up TO."""
    _init_git_repo(tmp_path, dirty=False)
    _init_state_repo(tmp_path, dirty=False, with_upstream=False)
    _commit_outer(tmp_path, ignore_artifacts=True)
    payload = json.dumps({"cwd": str(tmp_path), "session_id": nudge_session})
    result = run_hook("nudge-handoff.js", payload)
    assert "Artifacts" in json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"]


def test_nudge_state_repo_clean_and_pushed_is_silent(tmp_path: Path, nudge_session: str):
    _init_git_repo(tmp_path, dirty=False)
    _init_state_repo(tmp_path, dirty=False, with_upstream=True)
    _commit_outer(tmp_path, ignore_artifacts=True)
    payload = json.dumps({"cwd": str(tmp_path), "session_id": nudge_session})
    result = run_hook("nudge-handoff.js", payload)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_nudge_state_repo_warns_despite_recent_handoff(tmp_path: Path, nudge_session: str):
    """/handoff having run is a proxy; unpushed state is a measured fact."""
    _init_git_repo(tmp_path, dirty=False)
    _init_state_repo(tmp_path, dirty=True, with_upstream=True)
    _commit_outer(tmp_path, ignore_artifacts=True)
    transcript = tmp_path / "transcript.jsonl"
    transcript.write_text('{"role":"user","content":"/handoff"}\n')
    payload = json.dumps({
        "cwd": str(tmp_path), "session_id": nudge_session,
        "transcript_path": str(transcript),
    })
    result = run_hook("nudge-handoff.js", payload)
    assert "Artifacts" in json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"]


def test_nudge_plain_artifacts_dir_is_not_a_state_repo(tmp_path: Path, nudge_session: str):
    """Presence control: an ordinary tracked Artifacts/ (no nested .git) must
    stay silent — otherwise this fires in every project that has one."""
    _init_git_repo(tmp_path, dirty=False)
    (tmp_path / "Artifacts").mkdir()
    (tmp_path / "Artifacts" / "TODO.md").write_text("- [ ] task\n")
    _commit_outer(tmp_path, ignore_artifacts=False)  # tracked normally, tree clean
    payload = json.dumps({"cwd": str(tmp_path), "session_id": nudge_session})
    result = run_hook("nudge-handoff.js", payload)
    assert result.returncode == 0
    assert result.stdout.strip() == ""
