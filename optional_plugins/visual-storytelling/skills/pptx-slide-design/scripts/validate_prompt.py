"""Deterministic validator for emitted `pptx-slide-design` Copilot prompts.

Checks an emitted prompt against the invariants defined in
`Artifacts/Plans/VSE-1-Plan.md` §D1 (rule IDs VP-01..VP-06), calibrated against
`references/design-tokens.md` (13-part anatomy) and `references/reference-slides.md`
(the two gold-standard prompts). Per R1 (unproven Copilot-render core), checks target
only structural invariants expected to survive future wording/ordering tweaks inside a
section -- never the prose content of a section itself.

Usage:
    python validate_prompt.py path/to/prompt.txt [--no-layout-spec]
    cat prompt.txt | python validate_prompt.py [--no-layout-spec]

Output: one line per violation to stdout, `RULE-ID: message`.
Exit 0 = clean, exit 1 = one or more violations.
"""

from __future__ import annotations

import argparse
import re
import sys
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

FALLBACK_BANNER = "[fallback: visual-composition defaults]"

HEX_STRICT = re.compile(r"#[0-9A-Fa-f]{6}\b")
HEX_CANDIDATE = re.compile(r"#([0-9A-Za-z]{3,8})\b")
TOKEN_LEAK = re.compile(r"palette\.\w+|type\.scale\.\w+")

RE_COMMAND = re.compile(r"\b(rebuild|redesign|recreate)\s+slide\b", re.IGNORECASE)
# VP-01 part 2: content-truth directive. Phrasing-agnostic — the two gold prompts say
# "metaphor"/"show the actual", but any real-vs-abstract directive is valid (VSE HR1 rework).
RE_CONTENT_TRUTH = re.compile(
    r"\b(metaphor|show the (actual|real)|(actual|real)\s+\w+\s+object"
    r"|do not (make|turn|use) this)\b",
    re.IGNORECASE,
)
RE_NO_FULL_STOP = re.compile(r"no full stop", re.IGNORECASE)
RE_TOP_RIGHT = re.compile(r"top-right", re.IGNORECASE)
RE_FOOTER = re.compile(r"\bfooter\b", re.IGNORECASE)
RE_BACKGROUND = re.compile(r"\bbackground\b", re.IGNORECASE)
RE_NO_PHOTO = re.compile(r"no photographic", re.IGNORECASE)
RE_OVERALL_LAYOUT = re.compile(r"overall layout", re.IGNORECASE)
RE_REGION_MARKER = re.compile(r"\b(panel|card|region|zone)\s*\d+\b", re.IGNORECASE)
RE_PURPOSE_LINE = re.compile(r"purpose of this", re.IGNORECASE)
RE_FLOW_DEVICE = re.compile(r"\b(arrow|loop|connector|heatmap|flow)\b", re.IGNORECASE)
# VP-01 part 8: flow devices are archetype-conditional (design-tokens.md §13 lists Part 8 as
# brief-sourced). Only SEQUENTIAL layouts (storyboard, timeline, ordinal panels/stages) require
# a flow device; static layouts (grid of cards, hero, title, two-column, full-bleed) do not.
# Signals are structural layout words, chosen not to leak from content nouns ("iterative",
# "process") that appear in static slides (VSE HR1 rework).
RE_SEQUENTIAL_LAYOUT = re.compile(
    r"\b(storyboard|timeline|panel\s*\d|stage\s*\d)\b", re.IGNORECASE
)
# VP-01 part 9: bottom-line takeaway. Phrasing-agnostic (gold prompts use "bottom line"/
# "takeaway"; broadened so other valid closings pass) (VSE HR1 rework).
RE_TAKEAWAY_HEADER = re.compile(
    r"\b(bottom[- ]line|closing line|(key |slide )?takeaway|in short)\b", re.IGNORECASE
)
RE_VISUAL_TONE = re.compile(r"visual tone", re.IGNORECASE)
RE_WHAT_TO_AVOID = re.compile(r"what to avoid", re.IGNORECASE)
RE_SPEAKER_NOTE = re.compile(r"speaker note intent", re.IGNORECASE)

# VP-04: neither reference-slides.md gold prompt makes a genuine accessibility statement.
# Slide B has zero ratio/keyword occurrences; Slide A contains only incidental prose uses
# of "contrast"/"legible", not an accessibility assertion (VSE-1 audit, 2026-07-09).
# Per the D1 instruction "if a gold prompt fails, fix the validator, not the reference",
# the contrast signal accepts an explicit statement OR the structural proxy both gold
# prompts do carry: an explicit background colour plus a distinct text-ink colour, i.e.
# a stated foreground/background colour pair (see VSE-1-Plan D1 amendment + audit report).
RE_FONT_SIZE = re.compile(r"\d{1,2}(?:\.\d+)?\s*(?:[-–]\s*\d{1,2})?\s*pt\b", re.IGNORECASE)
RE_CONTRAST_WORD = re.compile(r"\b(contrast|legib\w*|accessib\w*)\b", re.IGNORECASE)
RE_RATIO = re.compile(r"\d(?:\.\d+)?\s*:\s*1\b")

RE_MULTI_STEP = re.compile(
    r"(\bfirst\b[,:]?\s+(copy|paste|generate|create)\b.{0,80}?\b(then|after that)\b)"
    r"|(\bthen\s+paste\b)"
    r"|(\bpaste\s+(this|the)\s+(first|next)\b)"
    r"|(\bstep\s*1\b.{0,200}?\bstep\s*2\b)",
    re.IGNORECASE | re.DOTALL,
)


@dataclass(frozen=True)
class Violation:
    """A single rule violation, formatted as the required stdout contract line."""

    rule_id: str
    message: str

    def __str__(self) -> str:
        return f"{self.rule_id}: {self.message}"


PART_NAMES: dict[int, str] = {
    1: "Command + purpose",
    2: "Content-truth directive",
    3: "Title + styling",
    4: "Furniture (badge, footer)",
    5: "Background",
    6: "Overall layout",
    7: "Per-region spec",
    8: "Flow / iteration devices",
    9: "Takeaway line",
    10: "Visual tone",
    11: "Forbidden list",
    12: "Palette (with hex)",
    13: "Speaker-note intent",
}

PART_CHECKERS: dict[int, Callable[[str], bool]] = {
    1: lambda text: bool(RE_COMMAND.search(text)),
    2: lambda text: bool(RE_CONTENT_TRUTH.search(text)),
    3: lambda text: bool(RE_NO_FULL_STOP.search(text)),
    4: lambda text: bool(RE_TOP_RIGHT.search(text)) and bool(RE_FOOTER.search(text)),
    5: lambda text: bool(RE_BACKGROUND.search(text)) and bool(RE_NO_PHOTO.search(text)),
    6: lambda text: bool(RE_OVERALL_LAYOUT.search(text)),
    7: lambda text: len(RE_REGION_MARKER.findall(text)) >= 2 or bool(RE_PURPOSE_LINE.search(text)),
    8: lambda text: (not RE_SEQUENTIAL_LAYOUT.search(text)) or bool(RE_FLOW_DEVICE.search(text)),
    9: lambda text: bool(RE_TAKEAWAY_HEADER.search(text)),
    10: lambda text: bool(RE_VISUAL_TONE.search(text)),
    11: lambda text: bool(RE_WHAT_TO_AVOID.search(text)),
    12: lambda text: len(set(HEX_STRICT.findall(text))) >= 3,
    13: lambda text: bool(RE_SPEAKER_NOTE.search(text)),
}


def check_vp01(text: str) -> list[Violation]:
    """VP-01: all 13 anatomy sections present (structural markers, not prose)."""
    return [
        Violation("VP-01", f"missing section {part_num} ({PART_NAMES[part_num]})")
        for part_num in sorted(PART_CHECKERS)
        if not PART_CHECKERS[part_num](text)
    ]


def check_vp02(text: str) -> list[Violation]:
    """VP-02: zero abstract token leakage (e.g. `palette.primary`, `type.scale.body`)."""
    leaks = sorted(set(TOKEN_LEAK.findall(text)))
    return [Violation("VP-02", f"abstract token leakage: '{leak}'") for leak in leaks]


def check_vp03(text: str) -> list[Violation]:
    """VP-03: every hex-like token is a well-formed `#RRGGBB`; >=1 must be present."""
    violations: list[Violation] = []
    malformed: set[str] = set()
    well_formed_count = 0
    for candidate in HEX_CANDIDATE.findall(text):
        if re.fullmatch(r"[0-9A-Fa-f]{6}", candidate):
            well_formed_count += 1
        else:
            malformed.add(candidate)
    for candidate in sorted(malformed):
        violations.append(Violation("VP-03", f"malformed hex value: '#{candidate}' (expected #RRGGBB)"))
    if well_formed_count == 0:
        violations.append(Violation("VP-03", "no well-formed hex colour value present (expected >=1 #RRGGBB)"))
    return violations


def check_vp04(text: str) -> list[Violation]:
    """VP-04: contrast/accessibility statement present, and font-size floors stated."""
    violations: list[Violation] = []
    if not RE_FONT_SIZE.search(text):
        violations.append(
            Violation("VP-04", "no font-size statement found (expected explicit pt sizes, e.g. '10-11pt')")
        )
    has_explicit_contrast = bool(RE_CONTRAST_WORD.search(text)) or bool(RE_RATIO.search(text))
    has_color_pair = bool(RE_BACKGROUND.search(text)) and len(set(HEX_STRICT.findall(text))) >= 2
    if not (has_explicit_contrast or has_color_pair):
        violations.append(
            Violation(
                "VP-04",
                "no contrast/accessibility statement found (expected a ratio, "
                "'contrast'/'legible' wording, or an explicit background+text colour pairing)",
            )
        )
    return violations


def check_vp05(text: str, no_layout_spec: bool) -> list[Violation]:
    """VP-05: fallback banner present if and only if --no-layout-spec was given."""
    has_banner = FALLBACK_BANNER in text
    if no_layout_spec and not has_banner:
        return [Violation("VP-05", f"--no-layout-spec given but fallback banner missing: expected literal '{FALLBACK_BANNER}'")]
    if not no_layout_spec and has_banner:
        return [Violation("VP-05", "fallback banner present without --no-layout-spec flag")]
    return []


def check_vp06(text: str) -> list[Violation]:
    """VP-06: single copy-paste block -- no multi-step user-interaction markers."""
    if RE_MULTI_STEP.search(text):
        return [Violation("VP-06", "multi-step interaction markers detected (prompt must be a single copy-paste block)")]
    return []


def validate(text: str, no_layout_spec: bool) -> list[Violation]:
    """Run all VP-01..VP-06 checks and return the combined violation list."""
    violations: list[Violation] = []
    violations.extend(check_vp01(text))
    violations.extend(check_vp02(text))
    violations.extend(check_vp03(text))
    violations.extend(check_vp04(text))
    violations.extend(check_vp05(text, no_layout_spec))
    violations.extend(check_vp06(text))
    return violations


def read_prompt(prompt_path: str | None) -> str:
    """Read prompt text from a file path, or stdin if no path was given."""
    if prompt_path is not None:
        path = Path(prompt_path)
        if not path.is_file():
            raise FileNotFoundError(f"prompt file not found: {prompt_path}")
        return path.read_text(encoding="utf-8")
    try:
        sys.stdin.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    except (AttributeError, ValueError):
        pass  # non-reconfigurable stream (e.g. piped bytes already utf-8); best-effort only
    return sys.stdin.read()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("prompt_path", nargs="?", default=None, help="Path to prompt text file; reads stdin if omitted.")
    parser.add_argument(
        "--no-layout-spec",
        action="store_true",
        help="Assert the fallback banner is required (no LAYOUT_SPEC.md was available).",
    )
    args = parser.parse_args(argv)

    try:
        text = read_prompt(args.prompt_path)
    except FileNotFoundError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    violations = validate(text, args.no_layout_spec)
    for violation in violations:
        print(violation)
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
