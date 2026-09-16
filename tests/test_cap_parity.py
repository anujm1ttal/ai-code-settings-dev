"""Four-side parity test for the BACKLOG lifecycle caps -- BGR-1 T4.

Asserts `max_lines` / `max_entries` / `max_entry_lines` agree across all four
places this phase landed them, plus the stated coherence invariant:

  1. JSON        -- hooks/backlog-caps.json (the authoritative source, T2)
  2. Py fallback  -- scripts/backlog_audit.py's FALLBACK_MAX_* literals (T2)
  3. JS fallback  -- hooks/session-boot.js's BACKLOG_CAPS_FALLBACK export (T3)
  4. Prose        -- rules/common/orchestration.md Sec BACKLOG Lifecycle (T1)

Oracle discipline (testing-strategy.md Sec Oracle Discipline): a parity test
dies by vacuously passing when a reader silently returns nothing on a
reworded file. Every reader below therefore asserts it extracted real
integers -- a FAIL, never a skip -- before any side is compared to another.
Nothing here compares against a hardcoded 600/20/30; every side is read from
its own artifact and compared only to its siblings.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import backlog_audit  # scripts/ is on sys.path via tests/conftest.py

REPO_ROOT = Path(__file__).resolve().parent.parent
CAPS_JSON_PATH = REPO_ROOT / "hooks" / "backlog-caps.json"
SESSION_BOOT_JS_PATH = REPO_ROOT / "hooks" / "session-boot.js"
ORCHESTRATION_MD_PATH = REPO_ROOT / "rules" / "common" / "orchestration.md"

CapTriple = tuple[int, int, int]  # (max_lines, max_entries, max_entry_lines)


def _read_json_caps() -> CapTriple:
    """Side 1: hooks/backlog-caps.json -- the documented single source of
    truth (BGR-1 T2)."""
    data = json.loads(CAPS_JSON_PATH.read_text(encoding="utf-8"))
    caps = (data.get("max_lines"), data.get("max_entries"), data.get("max_entry_lines"))
    assert all(isinstance(v, int) and not isinstance(v, bool) for v in caps), (
        f"JSON side did not yield three integers -- got {caps!r} from {CAPS_JSON_PATH}"
    )
    return caps  # type: ignore[return-value]


def _read_python_fallback_caps() -> CapTriple:
    """Side 2: scripts/backlog_audit.py's FALLBACK_MAX_* literals -- read
    directly off the imported module, deliberately independent of the
    JSON-loaded MAX_* names (module's own module-comment; BGR-1 T2)."""
    caps = (
        backlog_audit.FALLBACK_MAX_LINES,
        backlog_audit.FALLBACK_MAX_ENTRIES,
        backlog_audit.FALLBACK_MAX_ENTRY_LINES,
    )
    assert all(isinstance(v, int) and not isinstance(v, bool) for v in caps), (
        f"Python fallback side did not yield three integers -- got {caps!r} "
        "from backlog_audit.FALLBACK_MAX_*"
    )
    return caps


def _read_js_fallback_caps() -> CapTriple:
    """Side 3: hooks/session-boot.js's BACKLOG_CAPS_FALLBACK -- read by
    shelling out to node and `require()`-ing the real module.exports, which
    proves the export actually works (not just that its source text looks
    right). Fails loudly, never skips, if node is unavailable: this test
    suite already hard-depends on node for tests/test_session_boot_backlog.py
    (no skip there either), so silently tolerating its absence here would be
    an inconsistent, undocumented exemption from an existing dependency."""
    script = (
        "const m = require(process.argv[1]);"
        "process.stdout.write(JSON.stringify(m.BACKLOG_CAPS_FALLBACK));"
    )
    try:
        result = subprocess.run(
            ["node", "-e", script, str(SESSION_BOOT_JS_PATH)],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except FileNotFoundError as exc:
        raise AssertionError(
            "node is required to read the JS fallback side "
            f"({SESSION_BOOT_JS_PATH}'s module.exports) -- it is not optional here, "
            "tests/test_session_boot_backlog.py already depends on it elsewhere "
            "in this suite"
        ) from exc
    assert result.returncode == 0, (
        f"node failed reading {SESSION_BOOT_JS_PATH}: stderr={result.stderr!r}"
    )
    data = json.loads(result.stdout)
    caps = (data.get("max_lines"), data.get("max_entries"), data.get("max_entry_lines"))
    assert all(isinstance(v, int) and not isinstance(v, bool) for v in caps), (
        f"JS fallback side did not yield three integers -- got {caps!r} "
        f"from node output {result.stdout!r}"
    )
    return caps  # type: ignore[return-value]


# Three independent anchors into the prose (rules/common/orchestration.md
# Sec BACKLOG Lifecycle) -- the rotation-trigger sentence gives max_lines and
# max_entries, the per-entry-cap sentence gives max_entry_lines, and the
# threshold-coherence sentence's own stated arithmetic (e.g. "600 / 30 = 20")
# is cross-checked against the other two so two prose sentences drifting
# apart from EACH OTHER is caught too, not just prose-vs-code.
_ROTATION_TRIGGER_RE = re.compile(
    r"\*\*Rotation trigger\*\*: active `BACKLOG\.md` exceeds \*\*>(\d+) lines OR >(\d+) entries\*\*"
)
_PER_ENTRY_CAP_RE = re.compile(r"\*\*Per-entry cap\*\*: no entry exceeds \*\*(\d+) lines\*\*")
_COHERENCE_RE = re.compile(
    r"\*\*Threshold coherence \[invariant\]\*\*: `file cap ÷ per-entry cap ≥ entry cap` — "
    r"\*\*(\d+) ÷ (\d+) = (\d+) ✓\*\*"
)


def _read_prose_caps() -> CapTriple:
    """Side 4: rules/common/orchestration.md Sec BACKLOG Lifecycle. Extracts
    numbers from the document text -- never a typed-in expected value."""
    text = ORCHESTRATION_MD_PATH.read_text(encoding="utf-8")

    rotation_match = _ROTATION_TRIGGER_RE.search(text)
    assert rotation_match is not None, (
        "prose side: 'Rotation trigger' sentence not found (missing or reworded) in "
        f"{ORCHESTRATION_MD_PATH} -- update this regex, do not skip the check"
    )
    max_lines, max_entries = (int(rotation_match.group(1)), int(rotation_match.group(2)))

    per_entry_match = _PER_ENTRY_CAP_RE.search(text)
    assert per_entry_match is not None, (
        "prose side: 'Per-entry cap' sentence not found (missing or reworded) in "
        f"{ORCHESTRATION_MD_PATH} -- update this regex, do not skip the check"
    )
    max_entry_lines = int(per_entry_match.group(1))

    coherence_match = _COHERENCE_RE.search(text)
    assert coherence_match is not None, (
        "prose side: 'Threshold coherence' sentence not found (missing or reworded) in "
        f"{ORCHESTRATION_MD_PATH} -- update this regex, do not skip the check"
    )
    coh_numerator, coh_denominator, coh_quotient = (
        int(coherence_match.group(1)),
        int(coherence_match.group(2)),
        int(coherence_match.group(3)),
    )
    assert (coh_numerator, coh_denominator, coh_quotient) == (max_lines, max_entry_lines, max_entries), (
        "prose side: the 'Threshold coherence' sentence's own arithmetic "
        f"({coh_numerator} / {coh_denominator} = {coh_quotient}) disagrees with the "
        f"'Rotation trigger'/'Per-entry cap' sentences ({max_lines} / {max_entry_lines} "
        f"= {max_entries} expected) -- two prose sentences in the same file have drifted apart"
    )
    return (max_lines, max_entries, max_entry_lines)


def _read_all_sides() -> dict[str, CapTriple]:
    return {
        "json": _read_json_caps(),
        "python_fallback": _read_python_fallback_caps(),
        "js_fallback": _read_js_fallback_caps(),
        "prose": _read_prose_caps(),
    }


def _assert_all_equal(sides: dict[str, CapTriple], index: int, label: str) -> None:
    values = {name: caps[index] for name, caps in sides.items()}
    unique = set(values.values())
    assert len(unique) == 1, f"{label} disagree across sides: {values!r}"


def test_max_lines_parity_across_four_sides():
    sides = _read_all_sides()
    _assert_all_equal(sides, 0, "max_lines")


def test_max_entries_parity_across_four_sides():
    sides = _read_all_sides()
    _assert_all_equal(sides, 1, "max_entries")


def test_max_entry_lines_parity_across_four_sides():
    sides = _read_all_sides()
    _assert_all_equal(sides, 2, "max_entry_lines")


def test_coherence_invariant():
    """max_lines / max_entry_lines >= max_entries -- a file cap that cannot
    hold the entry count it advertises ships already-breached (orchestration.md
    Sec BACKLOG Lifecycle, 'Threshold coherence [invariant]')."""
    sides = _read_all_sides()
    _assert_all_equal(sides, 0, "max_lines")
    _assert_all_equal(sides, 1, "max_entries")
    _assert_all_equal(sides, 2, "max_entry_lines")
    max_lines, max_entries, max_entry_lines = sides["json"]
    assert max_lines / max_entry_lines >= max_entries, (
        f"coherence invariant violated: {max_lines} / {max_entry_lines} = "
        f"{max_lines / max_entry_lines} < {max_entries}"
    )
