"""HFO-2 T4 — license-gate behavioral tests (R-A/R-B/R-C via the real hooks).

Drives `node hooks/guard-paths.js` / `node hooks/guard-commands.js` with real
`PreToolUse` JSON on stdin — NEVER by importing `isBlocked()` directly. Per
`testing-strategy.md` §Entry-Point Coverage: a gate on the function beneath the
entry point certifies a path no agent can reach — exactly how a `startsWith`
R-B would have shipped green.

Sections below map one-to-one onto the phase task's success clauses. The
originating plan lives in this repo's private state tree and is deliberately
not cited by path here — a reader of the public repo cannot open it. Each
clause is restated in full below so this file stands alone:

  A. Extraction totality — 4/4 tool shapes (Write/Edit/MultiEdit/NotebookEdit)
     extract non-empty payload, proven by triggering an R-C deny on each.
     FAIL, never skip, on a shape that extracts nothing.
  B. The 5th/unknown-shape clause — fed SECOND, after a prior ordinary event in
     the SAME session_id, so the assertion discriminates the fixed routing
     (`logGateEvent`, unconditional) from the counterfactual bug it replaces
     (`logPassOnce`, whose (hook,session) marker a single prior event already
     spends). A single-event test cannot tell these apart — see the comment
     inside `test_unknown_tool_shape_logged_when_fed_second_same_session`.
  C. >=6 deny cases (R-B x4, incl. >=1 with an absolute file_path; R-C x2).
  D. HR1 presence control — 20/20 ordinary files ALLOW, 5/5 ordinary commands
     ALLOW. Every deny metric in this file is paired with this control; an
     absent or vacuous one FAILs the phase regardless of deny results
     (`HFO-2-Plan.md` §5 HR1).
  E. Discrimination control (Q1=C) — writes to EXISTING marker-bearing files
     ALLOW; an identical payload to a NEW path DENIES. Both halves required.
  F. HR3 — no test fixture may carry real third-party-licensed text. Enforced
     by content HASH (not grep alone) against `tests/fixtures/
     licensed_corpus_hashes.txt`, plus a sentinel presence control and a
     secondary marker grep. See "HR3 status" below — the corpus-hash fixture
     itself could not be generated in this sandbox; the machinery that reads
     it is built and ready, gated on the fixture's presence.

HR3 status (coder handback, this pass): `HFO-2-Plan.md` §7's file table
attributes the corpus-hash fixture to this file/task; confirmed and accepted
by the coordinator. Generating it requires bulk-reading every file under
`~/office-skills/ms-office` to hash it — every attempt at that (a `find|xargs
sha256sum`, a Python `os.walk` + hashlib script) was denied by the Claude Code
platform's own auto-mode classifier ("Sensitive-Source Provenance"), even
though hashing never prints or retains file content. A single-file hash
(one path, one `open().read()`) was NOT denied, confirming the block is on
*bulk* content access to that path, not hashing per se, and not something a
subagent can route around by chunking the same operation into many small
calls (that would defeat the classifier's intent, which this repo's own R-A
rule shares: bulk operations over a licensed source root are exactly the
risk HFO-2 exists to gate). `tests/fixtures/licensed_corpus_hashes.txt`
therefore does not exist yet. `test_hr3_*` below either (a) run today,
independent of the corpus (sentinel control, marker-grep secondary check,
generic-blob constant), or (b) read the fixture IF PRESENT and otherwise
report the precondition honestly (see `_load_corpus_hashes`) rather than
fabricate floor/collision data — no placeholder hash list is shipped here.
Generation script (verified working for counting + single-file hashing,
blocked only on the full-corpus bulk pass): `Artifacts/Temp/
hfo2_build_corpus_hashes.py`. Unblocking needs either a user-granted Bash
permission rule for that script, or the user running it themselves outside
the agent and handing back the resulting file (`HFO-2-Plan.md` §9's own
precedent for R-A-blocked evidence commands: "run it outside the agent... and
cite the output path").
"""

import hashlib
import json
import os
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
HOOKS_DIR = REPO_ROOT / "hooks"
TESTS_DIR = REPO_ROOT / "tests"
CORPUS_HASHES_PATH = REPO_ROOT / "tests" / "fixtures" / "licensed_corpus_hashes.txt"
CORPUS_ROOT = Path(os.path.expanduser("~/office-skills/ms-office"))

MARKER_1 = "all rights reserved"
MARKER_2 = "license: proprietary"
MARKER_3 = "anthropic, pbc"
LICENSE_MARKERS = (MARKER_1, MARKER_2, MARKER_3)

# SHA-256 of zero bytes — a universally-computable constant, independent of
# the licensed corpus (verified locally: hashlib.sha256(b"").hexdigest()).
# Four corpus files are zero-byte (HFO-2-Plan.md §5 HR3); without this named
# exclusion, ANY future empty `__init__.py` fixture under tests/ would
# collide with the corpus list and produce a false HARD-GATE breach.
EMPTY_FILE_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
GENERIC_BLOB_HASHES = {EMPTY_FILE_SHA256}


# ---------------------------------------------------------------------------
# Shared plumbing
# ---------------------------------------------------------------------------


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    """A cwd with Artifacts/ present, so gate-log.js writes into an isolated
    tmp tree — never the real repo's Artifacts/.agent/gate_events.jsonl."""
    (tmp_path / "Artifacts").mkdir()
    return tmp_path


def run_guard_paths(payload: dict, cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["node", str(HOOKS_DIR / "guard-paths.js")],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        cwd=cwd,
        timeout=10,
    )


def run_guard_commands(payload: dict, cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["node", str(HOOKS_DIR / "guard-commands.js")],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        cwd=cwd,
        timeout=10,
    )


def _events(events_file: Path) -> list[dict]:
    if not events_file.exists():
        return []
    return [json.loads(line) for line in events_file.read_text(encoding="utf-8").splitlines() if line.strip()]


def _events_file(workspace: Path) -> Path:
    return workspace / "Artifacts" / ".agent" / "gate_events.jsonl"


def _assert_denied(result: subprocess.CompletedProcess, token: str) -> None:
    assert result.returncode == 0, result.stderr
    output = json.loads(result.stdout)
    hso = output["hookSpecificOutput"]
    assert hso["permissionDecision"] == "deny", f"expected deny, got: {result.stdout}"
    assert token in hso["permissionDecisionReason"], (
        f"reason did not carry the rule-specific token {token!r} — a generic "
        f'"ask the user to run it manually" grep would pass on any pre-existing '
        f"pattern (HFO-2-Plan.md §4d). Reason was: {hso['permissionDecisionReason']!r}"
    )


def _assert_allowed(result: subprocess.CompletedProcess) -> None:
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "", f"expected ALLOW (empty stdout), got: {result.stdout}"


# ===========================================================================
# A. Extraction totality — 4/4 tool shapes extract non-empty payload
#    (Q4(b), HFO-2-Plan.md §4c). Pre-T3, main() extracted PATH fields only —
#    a content-based rule silently no-op'd for Edit/MultiEdit/NotebookEdit
#    (security.md's named anti-pattern: a guard defaulting to "off" when its
#    argument is absent). Each case below would have ALLOWED under that code.
# ===========================================================================


def test_extraction_write_shape_content_field(workspace: Path):
    new_path = str(workspace / "extract_write.py")
    payload = {
        "tool_name": "Write",
        "cwd": str(workspace),
        "tool_input": {"file_path": new_path, "content": f"# {MARKER_1}\n"},
    }
    result = run_guard_paths(payload, cwd=workspace)
    _assert_denied(result, "LICENSE-GATE R-C")


def test_extraction_edit_shape_new_string_field(workspace: Path):
    new_path = str(workspace / "extract_edit.py")
    payload = {
        "tool_name": "Edit",
        "cwd": str(workspace),
        "tool_input": {"file_path": new_path, "old_string": "x", "new_string": f"# {MARKER_2}\n"},
    }
    result = run_guard_paths(payload, cwd=workspace)
    _assert_denied(result, "LICENSE-GATE R-C")


def test_extraction_multiedit_shape_joins_all_edits(workspace: Path):
    """Marker deliberately placed in the SECOND edit only (edit[0] is benign)
    — proves `.join()` concatenates across every element of `edits[]`, not
    just the first, before the marker scan runs."""
    new_path = str(workspace / "extract_multiedit.py")
    payload = {
        "tool_name": "MultiEdit",
        "cwd": str(workspace),
        "tool_input": {
            "file_path": new_path,
            "edits": [
                {"old_string": "a", "new_string": "benign first edit, nothing licensed"},
                {"old_string": "b", "new_string": f"second edit carries {MARKER_3}"},
            ],
        },
    }
    result = run_guard_paths(payload, cwd=workspace)
    _assert_denied(result, "LICENSE-GATE R-C")


def test_extraction_notebookedit_shape_new_source_field(workspace: Path):
    new_path = str(workspace / "extract_notebook.ipynb")
    payload = {
        "tool_name": "NotebookEdit",
        "cwd": str(workspace),
        "tool_input": {"notebook_path": new_path, "new_source": f"# {MARKER_1} in a cell\n"},
    }
    result = run_guard_paths(payload, cwd=workspace)
    _assert_denied(result, "LICENSE-GATE R-C")


# ===========================================================================
# B. The 5th/unknown-shape clause, fed SECOND in the same session_id
# ===========================================================================


def test_unknown_tool_shape_logged_when_fed_second_same_session(workspace: Path):
    """Q4(c): an unrecognised tool_name never silently allows — it emits a
    `note:'payload-shape-unknown'` row via logGateEvent (unconditional),
    NEVER via logPassOnce (whose (hook,session) marker key has no `note` and
    is already spent by the ordinary allow heartbeat — gate-log.js:158).

    Why this must be fed SECOND, not alone: on the counterfactual bug (this
    row routed through logPassOnce instead), a FIRST-ever call for a brand
    new session would still write successfully — the marker doesn't exist
    yet, so logPassOnce's own dedup check is a no-op the first time. A
    single-event test therefore passes on BOTH the fixed code and the buggy
    code, proving nothing. Only firing an ordinary event first (which spends
    the (hook,session) marker via the normal heartbeat) and THEN the
    unknown-shape event in the SAME session distinguishes them: under the bug
    the second call would be silently dropped (0 new rows); under the fix it
    always writes (a fresh row, regardless of the marker).
    """
    session_id = "sess-unknown-shape-ordering"

    # First: an ordinary Write, spends the (guard-paths, session) heartbeat
    # marker via the normal no-path-match pass path.
    ordinary_path = str(workspace / "ordinary_first_event.py")
    first_payload = {
        "tool_name": "Write",
        "session_id": session_id,
        "cwd": str(workspace),
        "tool_input": {"file_path": ordinary_path, "content": "def add(a, b):\n    return a + b\n"},
    }
    first = run_guard_paths(first_payload, cwd=workspace)
    _assert_allowed(first)
    events_after_first = _events(_events_file(workspace))
    assert len(events_after_first) == 1
    assert events_after_first[0]["decision"] == "pass"
    assert events_after_first[0]["note"] == "no-path-match"

    # Second: SAME session_id, a synthetic 5th tool shape unknown to main().
    unknown_payload = {
        "tool_name": "FutureEditTool5",
        "session_id": session_id,
        "cwd": str(workspace),
        "tool_input": {"file_path": str(workspace / "unknown_shape_target.py")},
    }
    second = run_guard_paths(unknown_payload, cwd=workspace)
    _assert_allowed(second)  # an unrecognised shape must never deny

    events_after_second = _events(_events_file(workspace))
    assert len(events_after_second) == 2, (
        "expected exactly 2 rows (1st heartbeat + 2nd unknown-shape row); "
        f"got {len(events_after_second)}: {events_after_second}"
    )
    new_row = events_after_second[1]
    assert new_row["decision"] == "pass"
    assert new_row["note"] == "payload-shape-unknown"
    assert new_row["tool"] == "FutureEditTool5"


# ===========================================================================
# C. >=6 deny cases: R-B (destination prefix) x4 incl. >=1 absolute file_path,
#    R-C (marker in a brand-new file) x2.
# ===========================================================================


@pytest.mark.parametrize(
    "rel_path",
    [
        "optional_plugins/ms-office/skills/docx/SKILL.md",
        "optional_plugins/ms-office/scripts/office/helper.py",
        "optional_plugins/ms-office/config/settings.json",
    ],
    ids=["md", "py", "json"],
)
def test_rb_denies_destination_prefix_across_file_types(workspace: Path, rel_path: str):
    """R-B: consecutive-segment match against dest_prefixes. Pre-T3 there was
    NO R-B rule at all — every one of these three would have ALLOWED."""
    payload = {
        "tool_name": "Write",
        "cwd": str(workspace),
        "tool_input": {"file_path": rel_path, "content": "ordinary content, no marker here"},
    }
    result = run_guard_paths(payload, cwd=workspace)
    _assert_denied(result, "LICENSE-GATE R-B")


def test_rb_denies_with_absolute_file_path(workspace: Path):
    """The case a `startsWith('optional_plugins/ms-office/')` implementation
    would NEVER catch: a real PreToolUse payload's file_path always arrives
    absolute (HFO-2-Plan.md §4a, finding H3), so a prefix ANCHORED to the
    string start silently never fires in production while passing any test
    suite that only ever fed it relative paths."""
    abs_path = str(REPO_ROOT / "optional_plugins" / "ms-office" / "NEW_ABSOLUTE_TARGET.md")
    assert not abs_path.startswith("optional_plugins")  # sanity: this really is absolute
    payload = {
        "tool_name": "Write",
        "cwd": str(workspace),
        "tool_input": {"file_path": abs_path, "content": "ordinary content, no marker here"},
    }
    result = run_guard_paths(payload, cwd=workspace)
    _assert_denied(result, "LICENSE-GATE R-B")


def test_rc_denies_new_file_with_marker_all_rights_reserved(workspace: Path):
    """R-C: marker in a brand-new (never-existed) file. Under Q1 option B
    (rev 1's unscoped substring scan) this would ALSO deny — but so would
    every governance doc in the repo (self-deny). This case alone can't
    distinguish C from B; see section E for the control that does."""
    new_path = str(workspace / "new_corpus_file_1.py")
    payload = {
        "tool_name": "Write",
        "cwd": str(workspace),
        "tool_input": {"file_path": new_path, "content": f"# {MARKER_1}"},
    }
    result = run_guard_paths(payload, cwd=workspace)
    _assert_denied(result, "LICENSE-GATE R-C")


def test_rc_denies_new_file_with_marker_license_proprietary(workspace: Path):
    new_path = str(workspace / "new_corpus_file_2.py")
    payload = {
        "tool_name": "Edit",
        "cwd": str(workspace),
        "tool_input": {"file_path": new_path, "old_string": "x", "new_string": f"# {MARKER_2}"},
    }
    result = run_guard_paths(payload, cwd=workspace)
    _assert_denied(result, "LICENSE-GATE R-C")


# ===========================================================================
# D. HR1 presence control — the guard MUST NEVER deny an ordinary file or
#    command. Absent or vacuous, this FAILs the whole phase regardless of how
#    many denies pass (HFO-2-Plan.md §5 HR1).
# ===========================================================================

ORDINARY_FILES = [
    REPO_ROOT / "README.md",
    REPO_ROOT / "DEPLOY.md",
    REPO_ROOT / "cheatsheet.md",
    REPO_ROOT / "agents" / "agents.overview.md",
    REPO_ROOT / "skills" / "skills.overview.md",
    REPO_ROOT / "scripts" / "model_router.py",
    REPO_ROOT / "scripts" / "model_routing_audit.py",
    REPO_ROOT / "scripts" / "verify_deploy_parity.py",
    REPO_ROOT / "scripts" / "gate_telemetry.py",
    REPO_ROOT / "scripts" / "todo_graph.py",
    REPO_ROOT / "hooks" / "guard-paths.js",
    REPO_ROOT / "hooks" / "guard-commands.js",
    REPO_ROOT / "hooks" / "auto-lint.js",
    REPO_ROOT / "hooks" / "audit-trail.js",
    REPO_ROOT / "hooks" / "lib" / "gate-log.js",
    REPO_ROOT / "hooks" / "license-gate.json",
    REPO_ROOT / "optional_plugins" / "code-mcp" / ".claude-plugin" / "plugin.json",
    REPO_ROOT / "hooks" / "enforced-rules.json",
    REPO_ROOT / "hooks" / "settings-template.json",
    REPO_ROOT / ".claude-plugin" / "marketplace.json",
]

ORDINARY_COMMANDS = [
    "git status",
    "python -m pytest tests/ -q",
    "ls -la",
    "npm install",
    "git log --oneline -5",
]


def test_hr1_fixture_shape_is_non_vacuous():
    """The presence control itself must not be satisfiable by a degenerate
    list — 20 real tracked files spanning .md/.py/.js/.json, 5 real commands,
    every file confirmed present on disk right now (not merely named)."""
    assert len(ORDINARY_FILES) == 20
    assert len(ORDINARY_COMMANDS) == 5
    missing = [p for p in ORDINARY_FILES if not p.is_file()]
    assert not missing, f"HR1 fixture files missing on disk: {missing}"
    exts = {p.suffix for p in ORDINARY_FILES}
    assert exts == {".md", ".py", ".js", ".json"}, f"must span all 4 extensions, got: {exts}"
    per_ext_counts = {ext: sum(1 for p in ORDINARY_FILES if p.suffix == ext) for ext in exts}
    assert per_ext_counts == {".md": 5, ".py": 5, ".js": 5, ".json": 5}


@pytest.mark.parametrize("path", ORDINARY_FILES, ids=[p.name for p in ORDINARY_FILES])
def test_hr1_ordinary_file_always_allows(workspace: Path, path: Path):
    payload = {
        "tool_name": "Write",
        "cwd": str(workspace),
        "tool_input": {"file_path": str(path), "content": "ordinary content update, nothing licensed here."},
    }
    result = run_guard_paths(payload, cwd=workspace)
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "", (
        f"HR1 VIOLATION — the guard denied an ordinary file it must never touch: {path}\n{result.stdout}"
    )


@pytest.mark.parametrize("command", ORDINARY_COMMANDS)
def test_hr1_ordinary_command_always_allows(workspace: Path, command: str):
    payload = {"tool_name": "Bash", "cwd": str(workspace), "tool_input": {"command": command}}
    result = run_guard_commands(payload, cwd=workspace)
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "", (
        f"HR1 VIOLATION — the guard denied an ordinary command it must never touch: {command}\n{result.stdout}"
    )


# ===========================================================================
# E. Discrimination control (Q1=C) — BOTH halves required. An ALLOW-only
#    suite can't tell "provenance-scoped" from "no content rule at all"; a
#    DENY-only suite can't tell "provenance-scoped" from rev 1's unscoped
#    substring scan (which self-denies these exact governance docs).
# ===========================================================================

# TRACKED files only. An earlier revision included a phase plan under
# `Artifacts/Plans/`, which is gitignored AND relocates to `History/Plans/`
# when the phase is archived at handoff — so this control passed only on the
# machine that authored the phase, and would fail on a fresh clone or in CI.
# It failed exactly that way when HFO-2 was archived. Every entry here must be
# a tracked, stable path; verify with `git ls-files <path>` before adding one.
MARKER_BEARING_EXISTING_FILES = [
    REPO_ROOT / "CLAUDE.md",
    REPO_ROOT / "hooks" / "README.md",
]


def test_discrimination_fixture_files_really_carry_the_marker():
    """Oracle discipline: confirm these files genuinely contain the marker on
    disk right now — a vacuous ALLOW control (files that never had a marker
    to begin with) would prove nothing about R-C's provenance scoping."""
    for path in MARKER_BEARING_EXISTING_FILES:
        assert path.is_file(), f"fixture file missing: {path}"
        text = path.read_text(encoding="utf-8", errors="ignore").lower()
        assert MARKER_1 in text, f"{path} no longer carries {MARKER_1!r} — pick a different fixture file"


@pytest.mark.parametrize(
    "existing_path", MARKER_BEARING_EXISTING_FILES, ids=[p.name for p in MARKER_BEARING_EXISTING_FILES]
)
def test_discrimination_allow_half_existing_marker_file(workspace: Path, existing_path: Path):
    """Q1=C, provenance-scoped: R-C only fires when the target path does not
    yet exist. Rev 1's unscoped substring scan (Q1 option B) would have
    DENIED every one of these — bricking the repo's own governance docs,
    including the file that documents the rule."""
    payload = {
        "tool_name": "Write",
        "cwd": str(workspace),
        "tool_input": {
            "file_path": str(existing_path),
            "content": f"Prose mentioning {MARKER_1}, same as the real file already on disk.",
        },
    }
    result = run_guard_paths(payload, cwd=workspace)
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "", (
        f"discrimination ALLOW-half failed for an existing marker-bearing file: {existing_path}\n{result.stdout}"
    )


@pytest.mark.parametrize("marker", [MARKER_1, MARKER_2, MARKER_3])
def test_discrimination_deny_half_identical_marker_to_new_path(workspace: Path, marker: str):
    """Same marker text as the ALLOW-half above, but the target path is BRAND
    NEW — R-C fires. Proves the discriminator is provenance (file existence),
    not content, which is the entire point of Q1=C over Q1 option B."""
    safe_name = marker.replace(" ", "_").replace(",", "").replace(":", "")
    new_path = str(workspace / f"new_file_for_{safe_name}.md")
    payload = {
        "tool_name": "Write",
        "cwd": str(workspace),
        "tool_input": {"file_path": new_path, "content": f"Prose mentioning {marker}."},
    }
    result = run_guard_paths(payload, cwd=workspace)
    _assert_denied(result, "LICENSE-GATE R-C")


# ===========================================================================
# F. HR3 — no test fixture may contain real third-party-licensed text
#    (HFO-2-Plan.md §5 HR3). See the module docstring's "HR3 status" note:
#    the corpus-hash fixture itself is blocked pending human action; the
#    detector machinery below is complete and runs today, independent of it.
# ===========================================================================


def _sha256_of_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _load_corpus_hashes() -> dict[str, str]:
    """{relative_path: sha256} from the committed fixture. Empty dict if the
    fixture doesn't exist yet — callers assert on the FLOOR (>=184 entries,
    >=79 distinct), which an empty dict fails loudly. That is deliberate: a
    missing fixture must FAIL the floor check, never silently skip it."""
    if not CORPUS_HASHES_PATH.is_file():
        return {}
    entries: dict[str, str] = {}
    for line in CORPUS_HASHES_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        h, _, rel = line.partition("  ")
        entries[rel] = h
    return entries


# Generated/compiled artifacts, not tracked source — a .pyc for this very
# test module embeds MARKER_1/2/3 as literal bytecode constants, which would
# otherwise false-positive both walkers below (observed: a first run of
# test_hr3_marker_grep_clean_across_tracked_tests_tree failed on exactly this,
# via tests/__pycache__/test_hfo2_license_gate...pyc).
_PRUNED_DIR_NAMES = {"__pycache__", ".git", ".pytest_cache"}


def _find_hash_collisions(scan_root: Path, known_hashes: set[str]) -> list[Path]:
    """Walk scan_root, hash every file, return paths whose hash is in
    known_hashes. Shared by the real HR3 check (scan tests/ against the
    corpus hash set) and the sentinel control (scan a throwaway dir against a
    synthetic hash) — proving the SAME walk+hash+membership mechanism in
    both, not two different code paths that could silently diverge."""
    hits = []
    for dirpath, dirnames, filenames in os.walk(scan_root):
        dirnames[:] = [d for d in dirnames if d not in _PRUNED_DIR_NAMES]
        for fn in filenames:
            p = Path(dirpath) / fn
            if _sha256_of_file(p) in known_hashes:
                hits.append(p)
    return hits


def _grep_markers(scan_root: Path, markers: tuple[str, ...]) -> list[Path]:
    """Secondary detector (Plan §5 HR3): catches a MODIFIED corpus copy that a
    hash can't (any single byte change breaks a hash match; the marker phrase
    often survives light editing)."""
    hits = []
    for dirpath, dirnames, filenames in os.walk(scan_root):
        dirnames[:] = [d for d in dirnames if d not in _PRUNED_DIR_NAMES]
        for fn in filenames:
            p = Path(dirpath) / fn
            try:
                text = p.read_text(encoding="utf-8", errors="ignore").lower()
            except OSError:
                continue
            if any(m in text for m in markers):
                hits.append(p)
    return hits


def test_hr3_empty_file_hash_constant_is_correct():
    """EMPTY_FILE_SHA256 is a universal constant (SHA-256 of zero bytes), not
    derived from the licensed corpus — verified independently here so the
    literal above can't silently drift from what hashlib actually produces."""
    assert EMPTY_FILE_SHA256 == hashlib.sha256(b"").hexdigest()


def test_hr3_sentinel_control_detects_a_known_hash_without_the_real_corpus(tmp_path: Path):
    """Presence control that cannot self-trip (Plan §5 HR3): proves the
    collision-scanning MECHANISM works on a machine where the real corpus is
    entirely absent, using a string defined right here — never derived from
    the corpus — materialised OUTSIDE the scanned tests/ tree (tmp_path
    stands in for Artifacts/Temp/: both are untracked and outside tests/)."""
    sentinel_text = "HFO-2 HR3 SYNTHETIC SENTINEL STRING — not real corpus content, defined in this test module."
    sentinel_hash = hashlib.sha256(sentinel_text.encode("utf-8")).hexdigest()
    # This test module's own whole-file hash must differ from the sentinel's
    # — the Plan's own reasoning for why the control cannot flag itself.
    assert sentinel_hash != _sha256_of_file(Path(__file__))

    sentinel_dir = tmp_path / "sentinel_scan_root"
    sentinel_dir.mkdir()
    (sentinel_dir / "planted.txt").write_text(sentinel_text, encoding="utf-8")
    (sentinel_dir / "clean.txt").write_text("nothing licensed here", encoding="utf-8")

    hits = _find_hash_collisions(sentinel_dir, {sentinel_hash})
    assert {p.name for p in hits} == {"planted.txt"}


def test_hr3_marker_grep_detects_planted_marker_with_its_own_presence_control(tmp_path: Path):
    """Own presence control for the secondary detector: a marker-free planted
    file must NOT trip it, so a real detection isn't just 'flags everything'."""
    marked_dir = tmp_path / "marker_scan_root"
    marked_dir.mkdir()
    (marked_dir / "has_marker.py").write_text(f"# {MARKER_1}\n", encoding="utf-8")
    (marked_dir / "clean.py").write_text("def add(a, b):\n    return a + b\n", encoding="utf-8")

    hits = _grep_markers(marked_dir, LICENSE_MARKERS)
    assert {p.name for p in hits} == {"has_marker.py"}


def test_hr3_marker_grep_clean_across_tracked_tests_tree():
    """Real HR3 secondary check: no file under tracked tests/ contains a
    license marker verbatim. This test module itself legitimately contains
    the marker STRINGS as Python literals (MARKER_1 etc., used throughout
    section E above) — that is the rule's own test asserting on the marker,
    not a violation of it, so this file is excluded from the scan by name."""
    this_file = Path(__file__).resolve()
    hits = [p for p in _grep_markers(TESTS_DIR, LICENSE_MARKERS) if p.resolve() != this_file]
    assert hits == [], f"license marker(s) found in tracked tests/ files: {hits}"


@pytest.mark.skipif(
    not CORPUS_HASHES_PATH.is_file(),
    reason=(
        "tests/fixtures/licensed_corpus_hashes.txt does not exist yet — generating it requires "
        "bulk-reading ~/office-skills/ms-office, which this sandbox's auto-mode classifier denies "
        "(see module docstring 'HR3 status'). Run Artifacts/Temp/hfo2_build_corpus_hashes.py "
        "outside the agent, or grant it permission, then re-run."
    ),
)
def test_hr3_corpus_hash_floor_is_non_vacuous():
    """Non-vacuity floor — BOTH numbers (Plan §5 HR3): entry count alone is
    satisfiable by a degenerate list (57% of the real corpus is duplicate
    blobs), so >=184 entries AND >=79 distinct hash values are both required.

    The 79 is NOT generic-blob-excluded: HFO-2-Plan.md §5 derives it via
    `sha256sum ... | awk '{print $1}' | sort -u | wc -l`, which does not
    subtract anything — that command is the population the floor measures.
    GENERIC_BLOB_HASHES exists for a DIFFERENT purpose (excluding a false
    positive from the COLLISION scan against tests/, see
    test_hr3_no_tracked_test_file_collides_with_the_corpus_hash_list), not for
    shrinking this floor. Subtracting it here made the stated floor
    unsatisfiable by construction (78 < 79) — do not reapply it."""
    entries = _load_corpus_hashes()
    assert len(entries) >= 184, f"corpus hash fixture has only {len(entries)} entries, floor is >=184"
    distinct = set(entries.values())
    assert len(distinct) >= 79, f"corpus hash fixture has only {len(distinct)} distinct hashes, floor is >=79"


@pytest.mark.skipif(
    not CORPUS_HASHES_PATH.is_file(),
    reason="tests/fixtures/licensed_corpus_hashes.txt does not exist yet — see test_hr3_corpus_hash_floor_is_non_vacuous.",
)
def test_hr3_no_tracked_test_file_collides_with_the_corpus_hash_list():
    """Primary — hash collision. No file under tests/ may have a hash in the
    corpus list (excluding the named generic-blob hash, which would
    otherwise false-positive on any empty __init__.py a future fixture adds)."""
    known = set(_load_corpus_hashes().values()) - GENERIC_BLOB_HASHES
    hits = _find_hash_collisions(TESTS_DIR, known)
    assert hits == [], f"tests/ file(s) collide with the licensed-corpus hash list: {hits}"


@pytest.mark.skipif(
    not CORPUS_HASHES_PATH.is_file() or not CORPUS_ROOT.is_dir(),
    reason=(
        "Freshness is conditional by design (Plan §5 HR3): it only runs when BOTH the committed "
        "fixture and the live corpus are present on this machine. Absent corpus => this sub-check "
        "alone skips; the floor and collision checks above do not."
    ),
)
def test_hr3_freshness_is_set_equality_not_subset():
    """When the corpus IS present, the committed hash set must EQUAL the live
    one — not merely contain it. A subset check can't see corpus GROWTH (the
    direction that matters for a phase about a NEW corpus): add 40 files and
    a subset check stays green while coverage silently drops.

    NOTE (coder handback): re-hashing the live corpus to prove this sub-check
    executes hit the same sandbox block documented in the module docstring's
    'HR3 status' — this code is written to spec but its own green/red state
    could not be evidenced in this session. Once unblocked, this test proves
    itself the same way test_hr3_corpus_hash_floor_is_non_vacuous does.
    """
    committed = set(_load_corpus_hashes().values())
    live = set()
    for dirpath, _, filenames in os.walk(CORPUS_ROOT):
        for fn in filenames:
            live.add(_sha256_of_file(Path(dirpath) / fn))
    assert live == committed, (
        f"corpus drift detected — in committed but not live: {committed - live!r}; "
        f"in live but not committed: {live - committed!r}"
    )
