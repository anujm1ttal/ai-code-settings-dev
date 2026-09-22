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


# --------------------------------------------------------------------- HFO-2 T5 (license-gate remedy)


def _loss_mismatch(relpath: str) -> vdp.Mismatch:
    return vdp.Mismatch(
        relpath=relpath,
        classification=vdp.Classification.DEPLOYED_AHEAD,
        source_path=None,
        deployed_path=Path("dummy"),
    )


def test_format_report_encumbered_path_omits_git_add_and_keeps_caveat() -> None:
    """cpi1_parity-remedy-generic_1: an encumbered relpath must not be told to
    `git add` (that would back-port licensed content into the public tree),
    but the standing HARD-GATE caveat still ships."""
    gate = vdp.load_license_gate()
    encumbered_relpath = f"hooks/{gate.dest_prefixes[0]}SKILL.md"
    report = vdp.ParityReport(mismatches=(_loss_mismatch(encumbered_relpath),))

    output = vdp.format_report(report, Path("src"), Path("dest"))

    assert "git add" not in output
    assert "HARD-GATE" in output
    assert "LICENSE-GATE" in output


def test_format_report_ordinary_path_keeps_git_add_and_caveat() -> None:
    """Presence control (HR1-style): an ordinary drifted path must still get
    the real back-port instruction — the gate must discriminate, not just
    suppress `git add` for everyone."""
    report = vdp.ParityReport(mismatches=(_loss_mismatch("agents/coder.md"),))

    output = vdp.format_report(report, Path("src"), Path("dest"))

    assert output.count("git add") >= 1
    assert "HARD-GATE" in output


def test_format_report_mixed_report_discriminates_per_path() -> None:
    """Both halves in one report: the encumbered path's remedy carries no
    `git add`-the-encumbered-file instruction while the ordinary path's
    back-port instruction still fires."""
    gate = vdp.load_license_gate()
    encumbered_relpath = f"hooks/{gate.dest_prefixes[0]}SKILL.md"
    ordinary_relpath = "agents/coder.md"
    report = vdp.ParityReport(
        mismatches=(
            _loss_mismatch(encumbered_relpath),
            _loss_mismatch(ordinary_relpath),
        )
    )

    output = vdp.format_report(report, Path("src"), Path("dest"))

    assert "Back-port instruction" in output
    assert "LICENSE-GATE" in output
    assert encumbered_relpath in output.split("LICENSE-GATE", 1)[1].split("\n", 1)[0]

    # Converse (the regression this defect shipped): the back-port instruction
    # must name ONLY ordinary paths — "listed above" would have pulled in the
    # encumbered path too, since it legitimately appears in the classification
    # listing above. Assert on the instruction line itself, not the whole output.
    backport_line = next(line for line in output.splitlines() if line.startswith("Back-port instruction"))
    assert ordinary_relpath in backport_line
    assert encumbered_relpath not in backport_line


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
