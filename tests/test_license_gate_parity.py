"""Four-side parity test for the license gate config -- HFO-2 T1.

Asserts `source_roots` / `dest_prefixes` / `markers` / `self_exempt` agree
across all four places this task lands them:

  1. JSON        -- hooks/license-gate.json (the authoritative source)
  2. JS fallback  -- hooks/guard-commands.js's + hooks/guard-paths.js's
                     LICENSE_GATE_FALLBACK exports (both consumers must
                     carry the identical literal)
  3. Py fallback  -- scripts/verify_deploy_parity.py's LICENSE_GATE_FALLBACK
  4. Prose        -- hooks/README.md's "License Gate Config Parity" table

Oracle discipline (testing-strategy.md Sec Oracle Discipline): a parity test
dies by vacuously passing when a reader silently returns nothing on a
reworded file. Every reader below therefore asserts it extracted real,
non-empty values -- a FAIL, never a skip -- before any side is compared to
another.

Field order carries no meaning for these arrays (they are matched-against
sets, not ordered sequences, everywhere they are consumed), so sides are
compared as sets: a side that reorders its list is not a defect, one that
adds/drops/renames an entry is.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import verify_deploy_parity  # scripts/ is on sys.path via tests/conftest.py

REPO_ROOT = Path(__file__).resolve().parent.parent
LICENSE_GATE_JSON_PATH = REPO_ROOT / "hooks" / "license-gate.json"
GUARD_COMMANDS_JS_PATH = REPO_ROOT / "hooks" / "guard-commands.js"
GUARD_PATHS_JS_PATH = REPO_ROOT / "hooks" / "guard-paths.js"
README_PATH = REPO_ROOT / "hooks" / "README.md"

FIELDS = ("source_roots", "dest_prefixes", "markers", "self_exempt")
GateQuad = tuple[frozenset[str], frozenset[str], frozenset[str], frozenset[str]]


def _quad_from_mapping(data: dict, source_label: str) -> GateQuad:
    """Shared non-empty-extraction oracle: every field must be a non-empty
    list before this reading is trusted enough to compare against a sibling
    side."""
    for field in FIELDS:
        value = data.get(field)
        assert isinstance(value, list) and len(value) > 0, (
            f"{source_label}: field {field!r} did not yield a non-empty list -- "
            f"got {value!r} from {data!r}"
        )
    return tuple(frozenset(data[field]) for field in FIELDS)  # type: ignore[return-value]


def _read_json_gate() -> GateQuad:
    """Side 1: hooks/license-gate.json -- the documented single source of
    truth (HFO-2 T1)."""
    data = json.loads(LICENSE_GATE_JSON_PATH.read_text(encoding="utf-8"))
    return _quad_from_mapping(data, f"JSON side ({LICENSE_GATE_JSON_PATH})")


def _read_js_fallback_gate(js_path: Path) -> GateQuad:
    """Side 2 (one reading per consumer): a hook's LICENSE_GATE_FALLBACK
    export, read by shelling out to node and `require()`-ing the real
    module.exports -- proves the export actually works, not just that its
    source text looks right (mirrors tests/test_cap_parity.py's identical
    js-fallback reasoning). Fails loudly, never skips, if node is
    unavailable: this test suite already hard-depends on node for
    tests/test_session_boot_backlog.py (no skip there either), so silently
    tolerating its absence here would be an inconsistent, undocumented
    exemption from an existing dependency.
    """
    script = (
        "const m = require(process.argv[1]);"
        "process.stdout.write(JSON.stringify(m.LICENSE_GATE_FALLBACK));"
    )
    try:
        result = subprocess.run(
            ["node", "-e", script, str(js_path)],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except FileNotFoundError as exc:
        raise AssertionError(
            "node is required to read the JS fallback side "
            f"({js_path}'s module.exports) -- it is not optional here, "
            "tests/test_session_boot_backlog.py already depends on it elsewhere "
            "in this suite"
        ) from exc
    assert result.returncode == 0, (
        f"node failed reading {js_path}: stderr={result.stderr!r}"
    )
    data = json.loads(result.stdout)
    return _quad_from_mapping(data, f"JS fallback side ({js_path})")


def _read_python_fallback_gate() -> GateQuad:
    """Side 3: scripts/verify_deploy_parity.py's LICENSE_GATE_FALLBACK --
    read directly off the imported module (HFO-2 T1)."""
    fallback = verify_deploy_parity.LICENSE_GATE_FALLBACK
    data = {
        "source_roots": list(fallback.source_roots),
        "dest_prefixes": list(fallback.dest_prefixes),
        "markers": list(fallback.markers),
        "self_exempt": list(fallback.self_exempt),
    }
    return _quad_from_mapping(
        data, "Python fallback side (verify_deploy_parity.LICENSE_GATE_FALLBACK)"
    )


# Table-row extractor for hooks/README.md's "License Gate Config Parity"
# table -- never a typed-in expected value. Each row is
# `| `<field>` | `v1`, `v2`, ... |`; the values cell is parsed for its own
# backtick-quoted tokens rather than split on ", " so a value that itself
# contains a comma is still read correctly.
_README_ROW_RE = re.compile(r"^\|\s*`(?P<key>\w+)`\s*\|\s*(?P<values>.+?)\s*\|\s*$", re.MULTILINE)


def _read_readme_gate() -> GateQuad:
    """Side 4: hooks/README.md's "License Gate Config Parity" table.
    Extracts values from the document text -- never a typed-in expected
    value."""
    text = README_PATH.read_text(encoding="utf-8")
    rows: dict[str, list[str]] = {}
    for match in _README_ROW_RE.finditer(text):
        key = match.group("key")
        if key not in FIELDS:
            continue
        rows[key] = re.findall(r"`([^`]+)`", match.group("values"))

    missing = [field for field in FIELDS if not rows.get(field)]
    assert not missing, (
        "README side: 'License Gate Config Parity' table did not yield non-empty rows for "
        f"{missing!r} (missing or reworded) in {README_PATH} -- update this regex, "
        "do not skip the check"
    )
    return _quad_from_mapping(rows, f"README side ({README_PATH})")


def _read_all_sides() -> dict[str, GateQuad]:
    return {
        "json": _read_json_gate(),
        "guard_commands_js_fallback": _read_js_fallback_gate(GUARD_COMMANDS_JS_PATH),
        "guard_paths_js_fallback": _read_js_fallback_gate(GUARD_PATHS_JS_PATH),
        "python_fallback": _read_python_fallback_gate(),
        "readme": _read_readme_gate(),
    }


def _assert_all_equal(sides: dict[str, GateQuad], index: int, label: str) -> None:
    values = {name: quad[index] for name, quad in sides.items()}
    unique = set(values.values())
    assert len(unique) == 1, (
        f"{label} disagree across sides: "
        f"{ {name: sorted(v) for name, v in values.items()} }"
    )


def test_source_roots_parity_across_sides():
    sides = _read_all_sides()
    _assert_all_equal(sides, 0, "source_roots")


def test_dest_prefixes_parity_across_sides():
    sides = _read_all_sides()
    _assert_all_equal(sides, 1, "dest_prefixes")


def test_markers_parity_across_sides():
    sides = _read_all_sides()
    _assert_all_equal(sides, 2, "markers")


def test_self_exempt_parity_across_sides():
    sides = _read_all_sides()
    _assert_all_equal(sides, 3, "self_exempt")


def test_seed_floor_requirements():
    """HFO-2 T1's own success metric, checked against the JSON side (the
    authoritative source): >=2 source_roots, naming both
    office-skills/ms-office and .claude/skills/synced; >=1 dest_prefix;
    >=3 markers."""
    data = json.loads(LICENSE_GATE_JSON_PATH.read_text(encoding="utf-8"))
    assert len(data["source_roots"]) >= 2, (
        f"expected >=2 source_roots, got {data['source_roots']!r}"
    )
    assert "office-skills/ms-office" in data["source_roots"]
    assert ".claude/skills/synced" in data["source_roots"]
    assert len(data["dest_prefixes"]) >= 1, (
        f"expected >=1 dest_prefix, got {data['dest_prefixes']!r}"
    )
    assert len(data["markers"]) >= 3, f"expected >=3 markers, got {data['markers']!r}"


def test_self_exempt_names_license_gate_json():
    """Q1 tradeoff (b) (HFO-2-Plan.md Sec.3): the config file itself contains
    the markers it defines, so R-C must never read it as a payload."""
    data = json.loads(LICENSE_GATE_JSON_PATH.read_text(encoding="utf-8"))
    assert "hooks/license-gate.json" in data["self_exempt"]
