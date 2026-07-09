"""Tests for the `pptx-slide-design` quality-gate validators (VSE-1 D4).

Covers `validate_prompt.py` (rules VP-01..VP-06) and `contrast_check.py`. Gold-standard
prompt bodies are extracted from `references/reference-slides.md` by `##`-header parsing
(not hardcoded line numbers) so the tests survive the reference file growing. Seeded-bad
prompts are derived by mutating the extracted gold text in-test, never hardcoded strings.

Scripts are invoked as subprocesses (`subprocess.run([sys.executable, ...])`) per the
CLI contract -- the exit code and stdout ARE the contract, not internal function calls.
"""

from __future__ import annotations

import ast
import re
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILL_ROOT = REPO_ROOT / "optional_plugins" / "visual-storytelling" / "skills" / "pptx-slide-design"
VALIDATE_PROMPT_SCRIPT = SKILL_ROOT / "scripts" / "validate_prompt.py"
CONTRAST_CHECK_SCRIPT = SKILL_ROOT / "scripts" / "contrast_check.py"
REFERENCE_SLIDES_MD = SKILL_ROOT / "references" / "reference-slides.md"
TEMPLATES_MD = SKILL_ROOT / "references" / "slide-prompt-templates.md"

FALLBACK_BANNER = "[fallback: visual-composition defaults]"

# VP-01 part 8 device words (must stay in sync with validate_prompt.py RE_FLOW_DEVICE).
_FLOW_WORD_RE = re.compile(r"\b(arrow|loop|connector|heatmap|flow)\w*\b", re.IGNORECASE)


def _strip_flow_devices(prompt_text: str) -> str:
    """Neutralise every flow-device word so RE_FLOW_DEVICE no longer matches."""
    return _FLOW_WORD_RE.sub("element", prompt_text)


def _extract_reference_section(markdown_text: str, header_prefix: str) -> str:
    """Extract the body between a `##` header (matched by prefix) and the next `##` header."""
    lines = markdown_text.splitlines()
    start_index = next((i for i, line in enumerate(lines) if line.startswith(header_prefix)), None)
    if start_index is None:
        raise ValueError(f"section header not found: {header_prefix!r}")
    end_index = next(
        (i for i in range(start_index + 1, len(lines)) if lines[i].startswith("## ")),
        len(lines),
    )
    return "\n".join(lines[start_index + 1 : end_index]).strip()


def _top_level_imports(script_path: Path) -> set[str]:
    """Return top-level module names imported by `script_path` (ast-based, not regex)."""
    tree = ast.parse(script_path.read_text(encoding="utf-8"))
    module_names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            module_names.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module is not None and node.level == 0:
            module_names.add(node.module.split(".")[0])
    return module_names


def _run_validate_prompt(
    prompt_text: str, tmp_path: Path, extra_args: tuple[str, ...] = ()
) -> subprocess.CompletedProcess[str]:
    prompt_file = tmp_path / "prompt.txt"
    prompt_file.write_text(prompt_text, encoding="utf-8")
    return subprocess.run(
        [sys.executable, str(VALIDATE_PROMPT_SCRIPT), str(prompt_file), *extra_args],
        capture_output=True,
        text=True,
        check=False,
    )


def _run_contrast_check(spec_path: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(CONTRAST_CHECK_SCRIPT), str(spec_path)],
        capture_output=True,
        text=True,
        check=False,
    )


_REFERENCE_TEXT = REFERENCE_SLIDES_MD.read_text(encoding="utf-8")
GOLD_SLIDE_A = _extract_reference_section(_REFERENCE_TEXT, "## Reference Slide A")
GOLD_SLIDE_B = _extract_reference_section(_REFERENCE_TEXT, "## Reference Slide B")


def _extract_example_output(markdown_text: str, example_number: int) -> str:
    """Extract the fenced Output block for a numbered worked example in templates."""
    section = re.split(r"^### Example ", markdown_text, flags=re.M)
    for block in section[1:]:
        if block.lstrip().startswith(str(example_number)):
            match = re.search(
                r"\*\*Output \(Copy-Paste Ready Prompt\):\*\*\s*\n+```\n(.*?)\n```",
                block,
                re.S,
            )
            if match is None:
                raise ValueError(f"no Output block in Example {example_number}")
            return match.group(1)
    raise ValueError(f"Example {example_number} not found")


# Example 3 is a Grid of Cards: a STATIC (non-sequential) layout -- the canonical case
# a flow-device requirement must not spuriously fail. Extracted, not hardcoded.
GRID_EXAMPLE = _extract_example_output(TEMPLATES_MD.read_text(encoding="utf-8"), 3)
GRID_STATIC_NO_FLOW = _strip_flow_devices(GRID_EXAMPLE)

# Seeded-bad mutations, derived from the extracted gold text (not hardcoded strings).
_SPEAKER_NOTE_MARKER = "SPEAKER NOTE INTENT"
BAD_MISSING_SPEAKER_NOTE = GOLD_SLIDE_A[: GOLD_SLIDE_A.index(_SPEAKER_NOTE_MARKER)].rstrip()
BAD_TOKEN_LEAK = GOLD_SLIDE_A + "\n\nUse palette.primary for the accent colour."
BAD_MALFORMED_HEX = GOLD_SLIDE_A.replace("#C84A1E", "#12G45Z", 1)
GOLD_SLIDE_A_WITH_BANNER = GOLD_SLIDE_A + "\n\n" + FALLBACK_BANNER


@pytest.mark.parametrize("gold_text", [GOLD_SLIDE_A, GOLD_SLIDE_B], ids=["slide_a", "slide_b"])
def test_validate_prompt_gold_standard_prompt_exits_zero(gold_text: str, tmp_path: Path) -> None:
    result = _run_validate_prompt(gold_text, tmp_path)
    assert result.returncode == 0, result.stdout


SEEDED_BAD_CASES = [
    pytest.param(BAD_MISSING_SPEAKER_NOTE, "VP-01", id="missing_speaker_note_section"),
    pytest.param(BAD_TOKEN_LEAK, "VP-02", id="palette_token_leak"),
    pytest.param(BAD_MALFORMED_HEX, "VP-03", id="malformed_hex_value"),
]


@pytest.mark.parametrize("bad_text, expected_rule_id", SEEDED_BAD_CASES)
def test_validate_prompt_seeded_bad_prompt_exits_one_with_rule_id(
    bad_text: str, expected_rule_id: str, tmp_path: Path
) -> None:
    result = _run_validate_prompt(bad_text, tmp_path)
    assert result.returncode == 1
    assert expected_rule_id in result.stdout


VP05_EXIT_CASES = [
    pytest.param(GOLD_SLIDE_A_WITH_BANNER, ("--no-layout-spec",), 0, id="banner_with_flag_exit0"),
    pytest.param(GOLD_SLIDE_A_WITH_BANNER, (), 1, id="banner_without_flag_exit1"),
    pytest.param(GOLD_SLIDE_A, ("--no-layout-spec",), 1, id="plain_with_flag_exit1"),
]


@pytest.mark.parametrize("prompt_text, extra_args, expected_exit", VP05_EXIT_CASES)
def test_validate_prompt_vp05_fallback_banner_exit_code(
    prompt_text: str, extra_args: tuple[str, ...], expected_exit: int, tmp_path: Path
) -> None:
    result = _run_validate_prompt(prompt_text, tmp_path, extra_args)
    assert result.returncode == expected_exit


VP05_VIOLATION_CASES = [
    pytest.param(GOLD_SLIDE_A_WITH_BANNER, (), id="banner_without_flag_reports_vp05"),
    pytest.param(GOLD_SLIDE_A, ("--no-layout-spec",), id="plain_with_flag_reports_vp05"),
]


@pytest.mark.parametrize("prompt_text, extra_args", VP05_VIOLATION_CASES)
def test_validate_prompt_vp05_fallback_banner_reports_rule_id(
    prompt_text: str, extra_args: tuple[str, ...], tmp_path: Path
) -> None:
    result = _run_validate_prompt(prompt_text, tmp_path, extra_args)
    assert "VP-05" in result.stdout


def test_validate_prompt_static_layout_without_flow_device_passes(tmp_path: Path) -> None:
    """VP-01 part 8 is archetype-conditional: a static Grid of Cards with no flow device
    must pass (the VSE-1 HR1 regression -- storyboards need flow, grids do not)."""
    assert not re.search(r"\b(storyboard|timeline|panel\s*\d|stage\s*\d)\b", GRID_STATIC_NO_FLOW, re.I)
    result = _run_validate_prompt(GRID_STATIC_NO_FLOW, tmp_path)
    assert result.returncode == 0, result.stdout


def test_validate_prompt_sequential_layout_missing_flow_device_fails(tmp_path: Path) -> None:
    """Guard: the flow-device check is not lost -- a SEQUENTIAL layout (storyboard with
    ordinal panels) that omits its flow device still fails VP-01 on section 8."""
    sequential_missing_flow = _strip_flow_devices(GOLD_SLIDE_A)
    result = _run_validate_prompt(sequential_missing_flow, tmp_path)
    assert result.returncode == 1
    assert "section 8" in result.stdout


def test_validate_prompt_content_truth_alternate_phrasing_passes(tmp_path: Path) -> None:
    """VP-01 part 2 is phrasing-agnostic: a content-truth directive that avoids the gold
    prompts' exact words ('metaphor'/'show the actual') still satisfies the check."""
    rephrased = GRID_STATIC_NO_FLOW.replace(
        "Do not make this a metaphor — show the actual three methods as concrete, labelled cards.",
        "Show the real research methods, not an abstract sketch.",
    )
    assert "metaphor" not in rephrased.lower()
    result = _run_validate_prompt(rephrased, tmp_path)
    assert result.returncode == 0, result.stdout


def test_validate_prompt_takeaway_alternate_phrasing_passes(tmp_path: Path) -> None:
    """VP-01 part 9 is phrasing-agnostic: a takeaway using 'key takeaway' instead of the
    gold prompts' 'bottom line' still satisfies the check."""
    rephrased = GRID_STATIC_NO_FLOW.replace("BOTTOM LINE", "KEY TAKEAWAY")
    result = _run_validate_prompt(rephrased, tmp_path)
    assert result.returncode == 0, result.stdout


def test_contrast_check_known_fail_pair_exits_one_with_fail_line(tmp_path: Path) -> None:
    spec_path = tmp_path / "layout_spec_fail.md"
    spec_path.write_text("- Background: `#F5F1E8`\n- Text: `#888888`\n", encoding="utf-8")
    result = _run_contrast_check(spec_path)
    assert result.returncode == 1
    assert "FAIL" in result.stdout


def test_contrast_check_known_pass_pair_exits_zero_with_pass_line(tmp_path: Path) -> None:
    spec_path = tmp_path / "layout_spec_pass.md"
    spec_path.write_text("- Background: `#F5F1E8`\n- Text: `#2A2A2A`\n", encoding="utf-8")
    result = _run_contrast_check(spec_path)
    assert result.returncode == 0
    assert "PASS" in result.stdout


@pytest.mark.parametrize(
    "script_path", [VALIDATE_PROMPT_SCRIPT, CONTRAST_CHECK_SCRIPT], ids=["validate_prompt", "contrast_check"]
)
def test_script_top_level_imports_are_stdlib_only(script_path: Path) -> None:
    imported_modules = _top_level_imports(script_path)
    assert imported_modules <= sys.stdlib_module_names
