"""WCAG 2.1 contrast checker for design-spec files (VSE-1 D2).

Usage: python contrast_check.py <path-to-LAYOUT_SPEC.md-or-similar>

Parsing heuristic
-----------------
Input is treated as plain text (markdown or yaml) — no structural parser.
Each line is scanned for `#RRGGBB` hex tokens. If a line contains at least
one hex token, the substring *before the first hex token on that line* is
taken as the role label (markdown noise — `|`, `*`, backticks, `:`, `-` —
is stripped and the result lowercased). The label is then classified by
keyword match:

- **background** if it contains any of: background, bg, surface
- **text** if it contains any of: text, body, heading, caption, title,
  label, ink, font, type, primary
- otherwise the line is ignored (role not identifiable)

A text role is further flagged **large** (WCAG large-text threshold 3:1
instead of 4.5:1) if its label contains: heading, title, large, display,
hero. This is a heuristic, not a font-size measurement — the tool has no
access to actual point sizes from prose text, so section/title-adjacent
roles are assumed large and everything else is assumed body-scale (the
stricter, safer default).

Every (text role, background role) pair with distinct hex values is
checked once (deduplicated by hex pair, not by label) — informational for
files with many incidental hex mentions (e.g. reference tables), a hard
pass/fail gate for minimal LAYOUT_SPEC.md files with one bg + one text role.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

HEX_RE = re.compile(r"#[0-9A-Fa-f]{6}")
LABEL_NOISE_RE = re.compile(r"[|*`_:\-]+")

BACKGROUND_KEYWORDS = ("background", "bg", "surface")
TEXT_KEYWORDS = (
    "text", "body", "heading", "caption", "title", "label", "ink", "font",
    "type", "primary",
)
LARGE_KEYWORDS = ("heading", "title", "large", "display", "hero")

BODY_THRESHOLD = 4.5
LARGE_THRESHOLD = 3.0


@dataclass(frozen=True)
class ColorRole:
    label: str
    hex: str
    category: str  # "background" | "text"
    is_large: bool


def _clean_label(fragment: str) -> str:
    return LABEL_NOISE_RE.sub(" ", fragment).strip().lower()


def parse_roles(spec_text: str) -> list[ColorRole]:
    """Extract background/text hex roles from free-form md/yaml text."""
    roles: list[ColorRole] = []
    for line in spec_text.splitlines():
        hex_tokens = HEX_RE.findall(line)
        if not hex_tokens:
            continue
        label = _clean_label(line[: line.find(hex_tokens[0])])
        if any(keyword in label for keyword in BACKGROUND_KEYWORDS):
            category = "background"
        elif any(keyword in label for keyword in TEXT_KEYWORDS):
            category = "text"
        else:
            continue
        is_large = any(keyword in label for keyword in LARGE_KEYWORDS)
        for hex_value in hex_tokens:
            roles.append(ColorRole(label=label or category, hex=hex_value.upper(),
                                    category=category, is_large=is_large))
    return roles


def _linearize_channel(channel_8bit: int) -> float:
    normalized = channel_8bit / 255
    if normalized <= 0.03928:
        return normalized / 12.92
    return ((normalized + 0.055) / 1.055) ** 2.4


def relative_luminance(hex_color: str) -> float:
    hex_digits = hex_color.lstrip("#")
    r, g, b = (int(hex_digits[i:i + 2], 16) for i in (0, 2, 4))
    return (
        0.2126 * _linearize_channel(r)
        + 0.7152 * _linearize_channel(g)
        + 0.0722 * _linearize_channel(b)
    )


def contrast_ratio(hex_a: str, hex_b: str) -> float:
    luminance_a, luminance_b = relative_luminance(hex_a), relative_luminance(hex_b)
    lighter, darker = max(luminance_a, luminance_b), min(luminance_a, luminance_b)
    return (lighter + 0.05) / (darker + 0.05)


def check_contrast(spec_path: Path) -> int:
    """Print a PASS/FAIL contrast line per text/background pair; return exit code."""
    roles = parse_roles(spec_path.read_text(encoding="utf-8"))
    backgrounds = [role for role in roles if role.category == "background"]
    text_roles = [role for role in roles if role.category == "text"]

    if not backgrounds or not text_roles:
        print(
            f"No background/text hex pairs parsed from {spec_path} "
            f"(backgrounds={len(backgrounds)}, text_roles={len(text_roles)})"
        )
        return 0

    any_fail = False
    seen_pairs: set[tuple[str, str]] = set()
    for text_role in text_roles:
        for bg_role in backgrounds:
            if text_role.hex == bg_role.hex:
                continue
            pair_key = (text_role.hex, bg_role.hex)
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)

            ratio = contrast_ratio(text_role.hex, bg_role.hex)
            threshold = LARGE_THRESHOLD if text_role.is_large else BODY_THRESHOLD
            status = "PASS" if ratio >= threshold else "FAIL"
            any_fail = any_fail or status == "FAIL"
            print(
                f"{status} text[{text_role.label}] {text_role.hex} on "
                f"bg[{bg_role.label}] {bg_role.hex}: {ratio:.2f}:1 "
                f"(threshold {threshold}:1)"
            )

    return 1 if any_fail else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("spec_path", type=Path, help="Path to LAYOUT_SPEC.md or similar")
    args = parser.parse_args(argv)

    try:
        return check_contrast(args.spec_path)
    except FileNotFoundError as exc:
        print(f"Error: spec file not found: {args.spec_path}", file=sys.stderr)
        raise SystemExit(2) from exc


if __name__ == "__main__":
    sys.exit(main())
