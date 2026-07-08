#!/usr/bin/env python3
"""
Deploy Hook-Wiring Guard (LH-3 T2b)

Fails CLOSED for the *regression* case: if settings.json EXISTS, every
hooks/enforced-rules.json entry must be (a) present as a file under the
deployed hooks directory and (b) referenced under its declared event in that
settings.json. Any miss aborts the deploy (non-zero exit) naming the rule_id
and what's missing — this is the exact "deployed the .js but forgot to wire
settings" gap hit manually in LH-1 and LH-2.

If settings.json is entirely ABSENT, that is expected pre-wiring bootstrap
state (deploy.sh runs before hooks/README.md Step 2's manual settings merge
on a fresh machine's first deploy), not a regression — this WARNs loudly and
exits 0 so the deploy proceeds. Failing closed on "never configured yet"
would make the OS undeployable on a fresh machine, defeating the guard's
purpose of making enforcement *safe to rely on*, not brittle.

This is a deploy gate, not a runtime hook — the hook layer's fail-open rule
(coding-style.md / hooks/README.md) does NOT apply to the present-but-unwired
case above (LH-3-Plan.md Hard Rule 2).

Usage:
    python scripts/verify_hook_wiring.py \
        --manifest hooks/enforced-rules.json \
        --hooks-dir ~/.claude/hooks \
        --settings-file ~/.claude/settings.json

Exit code: 0 if every manifest rule is wired, or settings.json is absent
(WARN). 1 if settings.json exists but a rule is missing/unwired (FAIL).
"""

from __future__ import annotations

from pathlib import Path
import argparse
import io
import json
import sys


def load_manifest(path: Path) -> list[dict[str, object]]:
    """Parse hooks/enforced-rules.json into its list of rule entries."""
    data = json.loads(path.read_text(encoding="utf-8"))
    rules = data.get("rules")
    if not isinstance(rules, list):
        raise ValueError(f"Manifest {path} has no top-level \"rules\" list.")
    return rules


def load_settings(path: Path) -> dict | None:
    """Parse the live settings.json, or None if it does not exist."""
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def event_references_hook(settings: dict, event: str, hook_file: str) -> bool:
    """True if `hook_file` appears in a command under the declared event."""
    for matcher_block in settings.get("hooks", {}).get(event, []):
        for hook_entry in matcher_block.get("hooks", []):
            if hook_file in hook_entry.get("command", ""):
                return True
    return False


def absent_settings_warning(settings_file: Path) -> str:
    """Loud, non-fatal notice for the expected pre-wiring bootstrap state."""
    return (
        f"WARN: settings.json not found at {settings_file} — hooks are copied but NOT wired. "
        "Merge the hooks block from hooks/settings-template.json into it before relying on any "
        "gate (see hooks/README.md Step 2). Expected on a fresh machine's first deploy, not a "
        "regression — deploy proceeds."
    )


def check_wiring(
    manifest: list[dict[str, object]], hooks_dir: Path, settings: dict, settings_file: Path
) -> list[str]:
    """Return one failure message per unmet rule (empty list = all wired).

    Assumes `settings` is an already-parsed, non-None settings.json — callers
    must handle the settings-file-entirely-absent case separately (WARN, not
    FAIL; see absent_settings_warning) before calling this.
    """
    failures: list[str] = []
    for rule in manifest:
        rule_id = str(rule["rule_id"])
        hook_file = str(rule["hook_file"])
        event = str(rule["event"])

        hook_path = hooks_dir / hook_file
        if not hook_path.exists():
            failures.append(f"[{rule_id}] hook file missing: {hook_path}")
            continue

        if not event_references_hook(settings, event, hook_file):
            failures.append(
                f'[{rule_id}] {hook_file} not referenced under "{event}" in {settings_file}'
            )
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify enforced hooks are deployed and wired.")
    parser.add_argument("--manifest", required=True, help="Path to hooks/enforced-rules.json")
    parser.add_argument("--hooks-dir", required=True, help="Deployed hooks directory (e.g. ~/.claude/hooks)")
    parser.add_argument("--settings-file", required=True, help="Live settings.json path")
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    hooks_dir = Path(args.hooks_dir)
    settings_file = Path(args.settings_file)

    if not manifest_path.exists():
        print(f"FAIL: manifest not found: {manifest_path}", file=sys.stderr)
        return 1

    try:
        manifest = load_manifest(manifest_path)
    except (json.JSONDecodeError, ValueError) as exc:
        print(f"FAIL: could not parse manifest {manifest_path}: {exc}", file=sys.stderr)
        return 1

    try:
        settings = load_settings(settings_file)
    except json.JSONDecodeError as exc:
        print(f"FAIL: could not parse settings file {settings_file}: {exc}", file=sys.stderr)
        return 1

    if settings is None:
        print(absent_settings_warning(settings_file))
        return 0

    failures = check_wiring(manifest, hooks_dir, settings, settings_file)
    if failures:
        print(f"FAIL: {len(failures)} enforced hook(s) not wired:", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        return 1

    print(f"OK: all {len(manifest)} enforced hook(s) present and wired.")
    return 0


if __name__ == "__main__":
    # Force UTF-8 output — only when run as a script; reassigning sys.stdout
    # at import time corrupts pytest's capture fixture for any test that
    # imports this module (matches scripts/model_router.py / gate_telemetry.py).
    # Without this, non-ASCII characters (e.g. the em-dashes in
    # absent_settings_warning) mis-decode under Windows' default console
    # codepage instead of UTF-8.
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", newline="")
    sys.exit(main())
