"""Tests for scripts/verify_hook_wiring.py — LH-3 T2b/T5 (M1).

Covers the deploy.sh hook-wiring guard: fails CLOSED (non-zero, names the
rule_id + what's missing) on a simulated missing or unwired hook GIVEN
settings.json exists, and passes when every manifest entry is present and
referenced. A completely absent settings.json is a distinct, non-fatal case
(expected pre-wiring bootstrap state) — WARNs and exits 0; see
test_cli_absent_settings_warns_and_exits_zero.
"""

import json
import subprocess
import sys
from pathlib import Path

import verify_hook_wiring as vhw

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = REPO_ROOT / "scripts" / "verify_hook_wiring.py"

MANIFEST = {
    "rules": [
        {"rule_id": "guard-paths", "hook_file": "guard-paths.js", "event": "PreToolUse", "matcher": "Edit|Write", "blocking": True},
        {"rule_id": "nudge-handoff", "hook_file": "nudge-handoff.js", "event": "Stop", "matcher": "", "blocking": False},
    ]
}

WIRED_SETTINGS = {
    "hooks": {
        "PreToolUse": [{"matcher": "Edit|Write", "hooks": [{"type": "command", "command": 'node "/opt/hooks/guard-paths.js"'}]}],
        "Stop": [{"matcher": "", "hooks": [{"type": "command", "command": 'node "/opt/hooks/nudge-handoff.js"'}]}],
    }
}


def _write_json(path: Path, data: dict) -> Path:
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


def _make_hooks_dir(tmp_path: Path, files: list[str]) -> Path:
    hooks_dir = tmp_path / "hooks"
    hooks_dir.mkdir()
    for f in files:
        (hooks_dir / f).write_text("// stub\n", encoding="utf-8")
    return hooks_dir


# ---------------------------------------------------------------------------
# Unit-level: check_wiring()
# ---------------------------------------------------------------------------


def test_all_wired_passes(tmp_path: Path):
    hooks_dir = _make_hooks_dir(tmp_path, ["guard-paths.js", "nudge-handoff.js"])
    settings_file = _write_json(tmp_path / "settings.json", WIRED_SETTINGS)
    settings = vhw.load_settings(settings_file)

    failures = vhw.check_wiring(MANIFEST["rules"], hooks_dir, settings, settings_file)
    assert failures == []


def test_missing_hook_file_fails_naming_rule(tmp_path: Path):
    # nudge-handoff.js never copied to the deployed hooks dir.
    hooks_dir = _make_hooks_dir(tmp_path, ["guard-paths.js"])
    settings_file = _write_json(tmp_path / "settings.json", WIRED_SETTINGS)
    settings = vhw.load_settings(settings_file)

    failures = vhw.check_wiring(MANIFEST["rules"], hooks_dir, settings, settings_file)
    assert len(failures) == 1
    assert "[nudge-handoff]" in failures[0]
    assert "missing" in failures[0]


def test_unwired_hook_fails_naming_rule(tmp_path: Path):
    # Both files deployed, but settings.json never got the Stop entry merged
    # in — the exact LH-1/LH-2 gap this guard exists to catch.
    hooks_dir = _make_hooks_dir(tmp_path, ["guard-paths.js", "nudge-handoff.js"])
    unwired_settings = {
        "hooks": {
            "PreToolUse": [{"matcher": "Edit|Write", "hooks": [{"type": "command", "command": 'node "/opt/hooks/guard-paths.js"'}]}],
        }
    }
    settings_file = _write_json(tmp_path / "settings.json", unwired_settings)
    settings = vhw.load_settings(settings_file)

    failures = vhw.check_wiring(MANIFEST["rules"], hooks_dir, settings, settings_file)
    assert len(failures) == 1
    assert "[nudge-handoff]" in failures[0]
    assert "not referenced" in failures[0]


def test_absent_settings_warning_names_the_file():
    settings_file = Path("home") / "user" / ".claude" / "settings.json"
    warning = vhw.absent_settings_warning(settings_file)
    assert "WARN" in warning
    assert str(settings_file) in warning


# ---------------------------------------------------------------------------
# Process-level: the actual CLI, matching how deploy.sh invokes it
# ---------------------------------------------------------------------------


def _run_cli(manifest_file: Path, hooks_dir: Path, settings_file: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--manifest", str(manifest_file), "--hooks-dir", str(hooks_dir), "--settings-file", str(settings_file)],
        capture_output=True,
        text=True,
        timeout=10,
    )


def test_cli_fails_nonzero_and_names_rule_on_missing_hook(tmp_path: Path):
    manifest_file = _write_json(tmp_path / "enforced-rules.json", MANIFEST)
    hooks_dir = _make_hooks_dir(tmp_path, ["guard-paths.js"])  # nudge-handoff.js absent
    settings_file = _write_json(tmp_path / "settings.json", WIRED_SETTINGS)

    result = _run_cli(manifest_file, hooks_dir, settings_file)

    assert result.returncode != 0
    assert "nudge-handoff" in result.stderr
    assert "FAIL" in result.stderr


def test_cli_passes_zero_when_fully_wired(tmp_path: Path):
    manifest_file = _write_json(tmp_path / "enforced-rules.json", MANIFEST)
    hooks_dir = _make_hooks_dir(tmp_path, ["guard-paths.js", "nudge-handoff.js"])
    settings_file = _write_json(tmp_path / "settings.json", WIRED_SETTINGS)

    result = _run_cli(manifest_file, hooks_dir, settings_file)

    assert result.returncode == 0
    assert "OK" in result.stdout


def test_cli_absent_settings_warns_and_exits_zero(tmp_path: Path):
    # Fresh-machine first deploy: hooks are copied but settings.json was
    # never created — this must NOT fail the deploy (coordinator ruling).
    manifest_file = _write_json(tmp_path / "enforced-rules.json", MANIFEST)
    hooks_dir = _make_hooks_dir(tmp_path, ["guard-paths.js", "nudge-handoff.js"])
    settings_file = tmp_path / "settings.json"  # never created

    result = _run_cli(manifest_file, hooks_dir, settings_file)

    assert result.returncode == 0
    assert "WARN" in result.stdout
    assert "NOT wired" in result.stdout
    assert str(settings_file) in result.stdout


def test_real_manifest_is_valid_json_and_loadable():
    """The repo's own hooks/enforced-rules.json must parse and be non-empty."""
    manifest = vhw.load_manifest(REPO_ROOT / "hooks" / "enforced-rules.json")
    assert len(manifest) == 8
    rule_ids = {r["rule_id"] for r in manifest}
    assert rule_ids == {
        "session-boot", "guard-paths", "guard-commands", "auto-lint",
        "audit-trail", "nudge-handoff", "evidence-gate", "guard-shared-state",
    }
