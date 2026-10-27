"""Codex hook adapter contracts; Claude hook entry points remain unchanged."""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ADAPTER = ROOT / "hooks" / "codex-adapter.js"
TEMPLATE = ROOT / "hooks" / "codex-settings-template.json"


def run_adapter(
    hook: str, payload: dict, env_extra: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    if env_extra:
        env.update(env_extra)
    env.update({"TEMP": payload["cwd"], "TMP": payload["cwd"]})
    return subprocess.run(
        ["node", str(ADAPTER), hook],
        input=json.dumps(payload), text=True, capture_output=True, check=False,
        env=env,
    )


def test_codex_path_guard_denies_second_file_in_patch(tmp_path: Path) -> None:
    patch = "\n".join([
        "*** Begin Patch", "*** Add File: src/okay.py", "+print(1)",
        "*** Add File: secrets/.env", "+TOKEN=fixture", "*** End Patch",
    ])
    result = run_adapter("guard-paths", {
        "hook_event_name": "PreToolUse", "tool_name": "apply_patch",
        "tool_input": {"command": patch}, "cwd": str(tmp_path),
    })
    assert result.returncode == 0, result.stderr
    denial = json.loads(result.stdout)["hookSpecificOutput"]
    assert denial["permissionDecision"] == "deny"
    assert "secrets/.env" in denial["permissionDecisionReason"]


def test_codex_command_guard_denies_force_push(tmp_path: Path) -> None:
    result = run_adapter("guard-commands", {
        "hook_event_name": "PreToolUse", "tool_name": "Bash",
        "tool_input": {"command": "git push --force origin main"},
        "cwd": str(tmp_path),
    })
    assert result.returncode == 0, result.stderr
    denial = json.loads(result.stdout)["hookSpecificOutput"]
    assert denial["permissionDecision"] == "deny"
    assert "Force push" in denial["permissionDecisionReason"]


def test_codex_session_start_injects_current_task(tmp_path: Path) -> None:
    agent_dir = tmp_path / "Artifacts" / ".agent"
    agent_dir.mkdir(parents=True)
    (agent_dir / "current_task.md").write_text("Fixture task\n", encoding="utf-8")
    result = run_adapter("session-boot", {
        "hook_event_name": "SessionStart", "cwd": str(tmp_path),
    })
    assert result.returncode == 0, result.stderr
    assert "Fixture task" in json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"]


def fake_ruff_env(fake_dir: Path) -> dict[str, str]:
    env = os.environ.copy()
    if sys.platform == "win32":
        node_path = shutil.which("node")
        assert node_path
        shutil.copy(node_path, fake_dir / "ruff.exe")
        interceptor = fake_dir / "fake_ruff_intercept.js"
        interceptor.write_text(
            "const entry = process.argv[1] || '';\n"
            "if (!entry.endsWith('auto-lint.js') && !entry.endsWith('codex-adapter.js')) {\n"
            "  process.stdout.write('fixture.py:1:1: F401 unused import\\n');\n"
            "  process.exit(1);\n"
            "}\n", encoding="utf-8",
        )
        env["NODE_OPTIONS"] = f'--require "{interceptor.as_posix()}"'
    else:
        fake_ruff = fake_dir / "ruff"
        fake_ruff.write_text(
            "#!/bin/sh\necho 'fixture.py:1:1: F401 unused import'\nexit 1\n",
            encoding="utf-8",
        )
        fake_ruff.chmod(0o755)
    path_key = next((key for key in env if key.upper() == "PATH"), "PATH")
    env[path_key] = str(fake_dir) + os.pathsep + env.get(path_key, "")
    return env


def test_codex_auto_lint_reports_real_post_patch_linter_result(tmp_path: Path) -> None:
    (tmp_path / "fixture.py").write_text("import os\n", encoding="utf-8")
    patch = "*** Begin Patch\n*** Update File: fixture.py\n@@\n+import os\n*** End Patch"
    result = run_adapter("auto-lint", {
        "hook_event_name": "PostToolUse", "tool_name": "apply_patch",
        "tool_input": {"command": patch}, "cwd": str(tmp_path),
    }, env_extra=fake_ruff_env(tmp_path))
    assert result.returncode == 0, result.stderr
    context = json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"]
    assert "Codex Auto-Lint" in context
    assert "F401" in context
    assert "fix before proceeding" in context.lower()


def test_codex_apply_patch_normalizes_multiple_edit_targets(tmp_path: Path) -> None:
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "a.py").write_text("print('a')\n", encoding="utf-8")
    (tmp_path / "src" / "b.py").write_text("print('b')\n", encoding="utf-8")
    patch = "\n".join([
        "*** Begin Patch", "*** Update File: src/a.py", "@@", "+print('a')",
        "*** Add File: src/b.py", "+print('b')", "*** End Patch",
    ])
    js = (
        "const a=require(process.argv[1]); "
        "console.log(JSON.stringify(a.autoLintInputs(JSON.parse(process.argv[2]))));"
    )
    data = {"hook_event_name": "PostToolUse", "tool_name": "apply_patch",
            "tool_input": {"command": patch}, "cwd": str(tmp_path)}
    result = subprocess.run(
        ["node", "-e", js, str(ADAPTER), json.dumps(data)],
        text=True, capture_output=True, check=False,
    )
    assert result.returncode == 0, result.stderr
    assert [item["tool_input"]["file_path"] for item in json.loads(result.stdout)] == [
        "src/a.py", "src/b.py",
    ]


def test_codex_auto_lint_skips_deleted_patch_target(tmp_path: Path) -> None:
    (tmp_path / "remaining.py").write_text("print(1)\n", encoding="utf-8")
    patch = "\n".join([
        "*** Begin Patch", "*** Delete File: removed.py",
        "*** Update File: remaining.py", "@@", "+print(1)", "*** End Patch",
    ])
    js = "const a=require(process.argv[1]); console.log(JSON.stringify(a.autoLintInputs(JSON.parse(process.argv[2]))));"
    data = {"tool_input": {"command": patch}, "cwd": str(tmp_path)}
    result = subprocess.run(["node", "-e", js, str(ADAPTER), json.dumps(data)],
                            text=True, capture_output=True, check=False)
    assert result.returncode == 0, result.stderr
    assert [item["tool_input"]["file_path"] for item in json.loads(result.stdout)] == [
        "remaining.py",
    ]


def test_codex_transcript_maps_real_response_item_shapes(tmp_path: Path) -> None:
    patch = "*** Begin Patch\n*** Update File: src/app.py\n@@\n+print(1)\n*** End Patch"
    native = tmp_path / "codex.jsonl"
    native.write_text("\n".join(json.dumps(row) for row in [
        {"timestamp": "2026-10-26T10:00:00Z", "type": "response_item", "payload": {
            "type": "function_call", "name": "apply_patch", "call_id": "edit-1",
            "arguments": json.dumps({"command": patch}),
        }},
        {"timestamp": "2026-10-26T10:00:01Z", "type": "response_item", "payload": {
            "type": "function_call_output", "call_id": "edit-1", "output": "Success",
        }},
        {"timestamp": "2026-10-26T10:00:02Z", "type": "response_item", "payload": {
            "type": "message", "role": "assistant", "content": [
                {"type": "output_text", "text": "Fixed it."},
            ],
        }},
    ]), encoding="utf-8")
    js = (
        "const a=require(process.argv[1]); "
        "console.log(JSON.stringify(a.convertTranscript(process.argv[2])));"
    )
    result = subprocess.run(
        ["node", "-e", js, str(ADAPTER), str(native)],
        text=True, capture_output=True, check=False,
    )
    assert result.returncode == 0, result.stderr
    entries = json.loads(result.stdout)
    uses = [b for e in entries for b in e.get("message", {}).get("content", [])
            if b.get("type") == "tool_use"]
    assert [(u["name"], u["input"]["file_path"]) for u in uses] == [
        ("Edit", "src/app.py"),
    ]
    assert entries[-1]["message"]["content"][0]["text"] == "Fixed it."


def test_codex_evidence_stop_requests_one_continuation(tmp_path: Path) -> None:
    transcript = tmp_path / "native.jsonl"
    patch = "*** Begin Patch\n*** Update File: src/app.py\n@@\n+print(1)\n*** End Patch"
    rows = [
        {"timestamp": "2026-10-26T10:00:00Z", "type": "response_item", "payload": {
            "type": "function_call", "name": "apply_patch", "call_id": "edit-1",
            "arguments": json.dumps({"command": patch}),
        }},
        {"timestamp": "2026-10-26T10:00:01Z", "type": "response_item", "payload": {
            "type": "message", "role": "assistant", "content": [
                {"type": "output_text", "text": "Fixed it."},
            ],
        }},
    ]
    transcript.write_text("\n".join(json.dumps(row) for row in rows), encoding="utf-8")
    result = run_adapter("evidence-gate", {
        "hook_event_name": "Stop", "cwd": str(tmp_path),
        "transcript_path": str(transcript),
    })
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["decision"] == "block"
    assert "IRON LAW" in json.loads(result.stdout)["reason"]
    repeated = run_adapter("evidence-gate", {
        "hook_event_name": "Stop", "cwd": str(tmp_path),
        "transcript_path": str(transcript), "stop_hook_active": True,
    })
    assert repeated.returncode == 0, repeated.stderr
    assert repeated.stdout == ""


def test_codex_evidence_gate_reads_native_test_result(tmp_path: Path) -> None:
    transcript = tmp_path / "native.jsonl"
    rows = [
        {"timestamp": "2026-10-26T10:00:00Z", "type": "response_item", "payload": {
            "type": "function_call", "name": "apply_patch", "call_id": "edit-1",
            "arguments": json.dumps({"command":
                "*** Begin Patch\n*** Update File: src/app.py\n@@\n+print(1)\n*** End Patch"}),
        }},
        {"timestamp": "2026-10-26T10:00:01Z", "type": "response_item", "payload": {
            "type": "function_call", "name": "exec_command", "call_id": "test-1",
            "arguments": json.dumps({"cmd": "python -m pytest tests/ -q"}),
        }},
        {"timestamp": "2026-10-26T10:00:02Z", "type": "response_item", "payload": {
            "type": "function_call_output", "call_id": "test-1", "output": "2 passed; exit code: 0",
        }},
        {"timestamp": "2026-10-26T10:00:03Z", "type": "response_item", "payload": {
            "type": "message", "role": "assistant", "content": [
                {"type": "output_text", "text": "Fixed it."},
            ],
        }},
    ]
    transcript.write_text("\n".join(json.dumps(row) for row in rows), encoding="utf-8")
    result = run_adapter("evidence-gate", {"hook_event_name": "Stop", "cwd": str(tmp_path),
                                            "transcript_path": str(transcript)})
    assert result.returncode == 0, result.stderr
    assert result.stdout == ""


def test_codex_shared_state_guard_reads_patch_content(tmp_path: Path) -> None:
    transcript = tmp_path / "native.jsonl"
    transcript.write_text(json.dumps({
        "timestamp": "2026-10-26T10:00:00Z", "type": "response_item", "payload": {
            "type": "function_call", "name": "apply_patch", "call_id": "edit-1",
            "arguments": json.dumps({"command":
                "*** Begin Patch\n*** Update File: src/app.py\n@@\n+os.environ['X'] = 'Y'\n*** End Patch"}),
        },
    }), encoding="utf-8")
    result = run_adapter("guard-shared-state", {"hook_event_name": "Stop",
        "cwd": str(tmp_path), "transcript_path": str(transcript)})
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["decision"] == "block"
    assert "SHARED-STATE GUARD" in json.loads(result.stdout)["reason"]


def test_codex_handoff_nudge_reads_dirty_git_tree(tmp_path: Path) -> None:
    init = subprocess.run(["git", "init", "-q", str(tmp_path)],
                          text=True, capture_output=True, check=False)
    assert init.returncode == 0, init.stderr
    transcript = tmp_path / "native.jsonl"
    transcript.write_text(json.dumps({
        "timestamp": "2026-01-01T00:00:00Z", "type": "response_item", "payload": {
            "type": "message", "role": "assistant", "content": [
                {"type": "output_text", "text": "Working."},
            ],
        },
    }), encoding="utf-8")
    (tmp_path / "changed.txt").write_text("changed\n", encoding="utf-8")
    result = run_adapter("nudge-handoff", {"hook_event_name": "Stop",
        "session_id": "codex-handoff-fixture", "cwd": str(tmp_path),
        "transcript_path": str(transcript)})
    assert result.returncode == 0, result.stderr
    assert "Uncommitted changes" in json.loads(result.stdout)["systemMessage"]


def test_codex_audit_trail_records_patch_paths_without_content(tmp_path: Path) -> None:
    artifacts = tmp_path / "Artifacts"
    artifacts.mkdir()
    patch = "*** Begin Patch\n*** Add File: src/app.py\n+PRIVATE_FIXTURE_VALUE\n*** End Patch"
    result = run_adapter("audit-trail", {"hook_event_name": "PostToolUse",
        "tool_name": "apply_patch", "tool_input": {"command": patch},
        "cwd": str(tmp_path), "session_id": "audit-fixture"})
    assert result.returncode == 0, result.stderr
    log = (artifacts / ".agent" / "audit_trail.jsonl").read_text(encoding="utf-8")
    assert "src/app.py" in log
    assert "PRIVATE_FIXTURE_VALUE" not in log


def test_codex_subagent_start_and_stop_settle_only_matching_snapshot(tmp_path: Path) -> None:
    artifacts = tmp_path / "Artifacts"
    artifacts.mkdir()
    (artifacts / "TODO.md").write_text("before\n", encoding="utf-8")
    base = {"cwd": str(tmp_path), "session_id": "session-a",
            "agent_id": "agent-1", "agent_type": "coder"}
    start = run_adapter("task-diff-guard", {**base, "hook_event_name": "SubagentStart"})
    assert start.returncode == 0, start.stderr
    snapshots = list((artifacts / ".agent" / "codex-pre-task-snapshot").glob("**/manifest.json"))
    assert len(snapshots) == 1
    assert not (artifacts / ".agent" / "pre-task-snapshot").exists()
    (artifacts / "TODO.md").write_text("after\n", encoding="utf-8")
    transcript = tmp_path / "native.jsonl"
    transcript.write_text(json.dumps({
        "timestamp": "2026-10-26T10:00:00Z", "type": "response_item",
        "payload": {"type": "message", "role": "assistant",
                    "content": [{"type": "output_text", "text": "Reviewing changes."}]},
    }), encoding="utf-8")
    pending = run_adapter("task-diff-guard", {**base, "hook_event_name": "Stop",
        "transcript_path": str(transcript)})
    assert pending.returncode == 0, pending.stderr
    assert pending.stdout == ""
    assert snapshots[0].exists()
    stop = run_adapter("task-diff-guard", {**base, "hook_event_name": "SubagentStop"})
    assert stop.returncode == 0, stop.stderr
    assert json.loads(snapshots[0].read_text(encoding="utf-8"))["status"] == "returned"
    settled = run_adapter("task-diff-guard", {**base, "hook_event_name": "Stop",
        "transcript_path": str(transcript)})
    assert settled.returncode == 0, settled.stderr
    assert json.loads(settled.stdout)["decision"] == "block"
    assert "Artifacts/TODO.md" in json.loads(settled.stdout)["reason"]
    assert not snapshots[0].exists()


def test_codex_task_diff_sessions_do_not_share_barrier_or_snapshots(tmp_path: Path) -> None:
    artifacts = tmp_path / "Artifacts"
    artifacts.mkdir()
    (artifacts / "TODO.md").write_text("before\n", encoding="utf-8")
    a = {"cwd": str(tmp_path), "session_id": "session-a", "agent_id": "agent-a",
         "agent_type": "coder"}
    b = {"cwd": str(tmp_path), "session_id": "session-b", "agent_id": "agent-b",
         "agent_type": "auditor"}
    assert run_adapter("task-diff-guard", {**a, "hook_event_name": "SubagentStart"}).returncode == 0
    assert run_adapter("task-diff-guard", {**b, "hook_event_name": "SubagentStart"}).returncode == 0
    snapshots = list((artifacts / ".agent" / "codex-pre-task-snapshot").glob("**/manifest.json"))
    assert len(snapshots) == 2
    (artifacts / "TODO.md").write_text("after\n", encoding="utf-8")
    assert run_adapter("task-diff-guard", {**a, "hook_event_name": "SubagentStop"}).returncode == 0
    transcript = tmp_path / "native.jsonl"
    transcript.write_text(json.dumps({"timestamp": "2026-10-26T10:00:00Z",
        "type": "response_item", "payload": {"type": "message", "role": "assistant",
        "content": [{"type": "output_text", "text": "Reviewing."}]}}), encoding="utf-8")
    settled = run_adapter("task-diff-guard", {**a, "hook_event_name": "Stop",
        "transcript_path": str(transcript)})
    assert settled.returncode == 0, settled.stderr
    assert json.loads(settled.stdout)["decision"] == "block"
    assert "Artifacts/TODO.md" in json.loads(settled.stdout)["reason"]
    assert len(list((artifacts / ".agent" / "codex-pre-task-snapshot").glob("**/manifest.json"))) == 1


def test_codex_settings_route_all_hooks_through_adapter() -> None:
    hooks = json.loads(TEMPLATE.read_text(encoding="utf-8"))["hooks"]
    wired = [(event, group.get("matcher", ""), command["command"])
             for event, groups in hooks.items()
             for group in groups for command in group["hooks"]]
    assert len(wired) == 11
    assert all("__CODEX_HOOKS_DIR__" in command and "codex-adapter.js" in command
               for _, _, command in wired)
    assert not any(event in ("PreToolUse", "PostToolUse") and
                   matcher == "Task|Agent" for event, matcher, _ in wired)
    assert ("SubagentStart", "", "node '__CODEX_HOOKS_DIR__/codex-adapter.js' task-diff-guard") in wired
    assert ("SubagentStop", "", "node '__CODEX_HOOKS_DIR__/codex-adapter.js' task-diff-guard") in wired
