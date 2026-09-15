"""Tests for scripts/verify_deploy_parity.py — DSD-1 T2.

Covers the deployed-vs-source drift detector: the four classifications
(source-ahead / deployed-ahead / deployed-only / source-only), the
CR-insensitive comparison (Risk 1 control), the fail-closed exit-code
polarity (Risk 2 control: source-ahead must NOT block), and a replay of the
real `fd7af9b` loss instance as a fixture (deployed-ahead reconstruction).

Fixtures never touch the real `~/.claude/` — every source/dest root is a
tmp_path directory, and git history (where needed for the discriminator) is
built in a throwaway `git init` repo under tmp_path.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

import verify_deploy_parity as vdp

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = REPO_ROOT / "scripts" / "verify_deploy_parity.py"
REPLAY_COMMIT = "fd7af9bb35d732c14471c4078bbfe43b54d1c19b"
REPLAY_FILES = ("rules/common/orchestration.md", "commands/handoff.md")


def _git(*args: str, cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", *args], cwd=str(cwd), capture_output=True, check=True
    )


def _init_repo(root: Path) -> None:
    root.mkdir(parents=True, exist_ok=True)
    _git("init", "-q", cwd=root)
    _git("config", "user.email", "test@example.com", cwd=root)
    _git("config", "user.name", "Test", cwd=root)


def _write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def _commit(root: Path, message: str) -> None:
    _git("add", "-A", cwd=root)
    _git("commit", "-q", "-m", message, cwd=root)


def _show_from_real_repo(ref: str, relpath: str) -> bytes:
    """Read a blob straight from THIS repo's history — read-only, no writes."""
    result = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "show", f"{ref}:{relpath}"],
        capture_output=True, check=True,
    )
    return result.stdout


# --------------------------------------------------------------------- polarities


def test_deployed_ahead_fixture_exits_one_and_names_file(tmp_path: Path) -> None:
    source_root = tmp_path / "source"
    dest_root = tmp_path / "dest"
    _init_repo(source_root)
    _write(source_root / "rules" / "thing.md", b"line one\n")
    _commit(source_root, "initial")
    # Deployed carries an edit typed directly into production, never committed.
    _write(dest_root / "rules" / "thing.md", b"line one\nline two, never committed\n")

    report = vdp.build_report(source_root, dest_root)

    assert report.has_loss is True
    assert len(report.mismatches) == 1
    mismatch = report.mismatches[0]
    assert mismatch.relpath == "rules/thing.md"
    assert mismatch.classification is vdp.Classification.DEPLOYED_AHEAD


def test_source_ahead_fixture_exits_zero_not_blocking(tmp_path: Path) -> None:
    source_root = tmp_path / "source"
    dest_root = tmp_path / "dest"
    _init_repo(source_root)
    # Deployed holds the OLDER, already-committed revision.
    _write(source_root / "rules" / "thing.md", b"old content\n")
    _commit(source_root, "old revision")
    _write(dest_root / "rules" / "thing.md", b"old content\n")
    # Source has since moved on — the normal pre-deploy state.
    _write(source_root / "rules" / "thing.md", b"new content\n")
    _commit(source_root, "new revision")

    report = vdp.build_report(source_root, dest_root)

    assert len(report.mismatches) == 1
    mismatch = report.mismatches[0]
    assert mismatch.classification is vdp.Classification.SOURCE_AHEAD
    assert report.has_loss is False  # Risk 2 control: must not block


def test_crlf_only_difference_reports_zero_drift(tmp_path: Path) -> None:
    source_root = tmp_path / "source"
    dest_root = tmp_path / "dest"
    _write(source_root / "rules" / "thing.md", b"line one\nline two\n")
    _write(dest_root / "rules" / "thing.md", b"line one\r\nline two\r\n")

    report = vdp.build_report(source_root, dest_root)

    assert report.mismatches == ()
    assert report.has_loss is False


def test_deployed_only_fixture_exits_one_and_names_file(tmp_path: Path) -> None:
    source_root = tmp_path / "source"
    dest_root = tmp_path / "dest"
    _write(dest_root / "rules" / "orphan.md", b"deployed only, never in source\n")

    report = vdp.build_report(source_root, dest_root)

    assert report.has_loss is True
    assert len(report.mismatches) == 1
    mismatch = report.mismatches[0]
    assert mismatch.relpath == "rules/orphan.md"
    assert mismatch.classification is vdp.Classification.DEPLOYED_ONLY


def test_source_only_fixture_exits_zero_not_blocking(tmp_path: Path) -> None:
    source_root = tmp_path / "source"
    dest_root = tmp_path / "dest"
    _write(source_root / "rules" / "new-file.md", b"pending add\n")

    report = vdp.build_report(source_root, dest_root)

    assert len(report.mismatches) == 1
    assert report.mismatches[0].classification is vdp.Classification.SOURCE_ONLY
    assert report.has_loss is False


# --------------------------------------------------------------------- replay control


@pytest.mark.parametrize("relpath", REPLAY_FILES)
def test_replay_fd7af9b_reports_deployed_ahead(tmp_path: Path, relpath: str) -> None:
    """Reconstruct the exact fd7af9b loss instance: source = the pre-backport
    commit (fd7af9b^, lacking the production edit), deployed = the
    post-backport content (fd7af9b, the edit that was live in production and
    existed in no commit at the time). The fixture repo's history is built
    from ONLY the pre-backport commit, so the discriminator must find no
    match for the deployed content — reproducing what the real detector
    would have reported before fd7af9b was ever committed."""
    before = _show_from_real_repo(f"{REPLAY_COMMIT}^", relpath)
    after = _show_from_real_repo(REPLAY_COMMIT, relpath)
    assert before != after  # sanity: the replay fixture is not degenerate

    source_root = tmp_path / "source"
    dest_root = tmp_path / "dest"
    _init_repo(source_root)
    _write(source_root / relpath, before)
    _commit(source_root, "pre-backport state")
    _write(dest_root / relpath, after)

    report = vdp.build_report(source_root, dest_root)

    matching = [m for m in report.mismatches if m.relpath == relpath]
    assert len(matching) == 1
    assert matching[0].classification is vdp.Classification.DEPLOYED_AHEAD
    assert report.has_loss is True


# --------------------------------------------------------------------- CLI / process level


def _run_cli(source_root: Path, dest_root: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--source-root", str(source_root), "--dest-root", str(dest_root)],
        capture_output=True, text=True, timeout=30,
    )


def test_cli_exits_zero_on_clean_tree(tmp_path: Path) -> None:
    source_root = tmp_path / "source"
    dest_root = tmp_path / "dest"
    _write(source_root / "rules" / "thing.md", b"same content\n")
    _write(dest_root / "rules" / "thing.md", b"same content\n")

    result = _run_cli(source_root, dest_root)

    assert result.returncode == 0
    assert "no drift" in result.stdout.lower()


def test_cli_exits_one_and_prints_backport_instruction(tmp_path: Path) -> None:
    source_root = tmp_path / "source"
    dest_root = tmp_path / "dest"
    _init_repo(source_root)
    _write(source_root / "rules" / "thing.md", b"line one\n")
    _commit(source_root, "initial")
    _write(dest_root / "rules" / "thing.md", b"line one\nnever committed\n")

    result = _run_cli(source_root, dest_root)

    assert result.returncode == 1
    assert "rules/thing.md" in result.stdout
    assert "deployed-ahead" in result.stdout
    assert "back-port" in result.stdout.lower()


def test_cli_prints_covered_scope_and_exclusions(tmp_path: Path) -> None:
    source_root = tmp_path / "source"
    dest_root = tmp_path / "dest"

    result = _run_cli(source_root, dest_root)

    assert result.returncode == 0
    for dirname in vdp.SURFACE_DIRS:
        assert dirname in result.stdout
    assert "optional_plugins" in result.stdout
    assert "settings.json" in result.stdout


# --------------------------------------------------------------------- HR1 (zero writes)


def test_script_has_no_write_calls() -> None:
    """Hard Rule 1: the detector never writes to ~/.claude/ or the repo —
    grep the source for any write-capable call."""
    source = SCRIPT.read_text(encoding="utf-8")
    forbidden = (
        "write_text(", "write_bytes(", "shutil.copy", "shutil.rmtree",
        "os.remove", "os.rmdir", "Path.mkdir", ".unlink(", "open(",
    )
    for token in forbidden:
        assert token not in source, f"forbidden write-capable call found: {token}"
