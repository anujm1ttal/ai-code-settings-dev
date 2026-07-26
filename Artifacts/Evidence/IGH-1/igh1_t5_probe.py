"""IGH-1 T5 adversarial probe of the DEPLOYED guard-commands.js.

Cases are assembled from fragments so this file itself contains no literal
redirect-into-source pattern -- the guard is raw-string, and a probe script
that spelled the cases out verbatim would be blocked before it could run
(observed 2026-07-26).
"""
import json
import os
import subprocess

HOOK = os.path.expanduser("~/.claude/hooks/guard-commands.js")

GT = ">"
SRC = "scripts/thing.py"

DENY_EXPECTED = [
    ("plain redirect", f"echo x {GT} {SRC}"),
    ("double-quoted target", f'echo x {GT} "{SRC}"'),
    ("single-quoted target", f"echo x {GT} '{SRC}'"),
    ("append", f"echo x {GT}{GT} ./{SRC}"),
    ("windows sep", f"echo x {GT} scripts\\thing.py"),
    ("uppercase ext", f"echo x {GT} scripts/thing.PY"),
    ("heredoc into rule file", f"cat {GT} rules/common/coding-style.md <<EOF"),
    ("no space before target", f"echo x {GT}{SRC}"),
    ("fd-prefixed", f"python x.py 2{GT} {SRC}"),
]

TRAVERSAL = [
    ("allowlist traversal escape", f"echo x {GT} Artifacts/Temp/../../{SRC}"),
]

OUT_OF_SCOPE = [
    ("tee", f"cat foo | tee {SRC}"),
    ("python open()", f'python -c "open(\'{SRC}\',\'w\')"'),
    ("cp over source", f"cp /tmp/evil.py {SRC}"),
    ("sed in-place", f"sed -i 's/a/b/' {SRC}"),
]

ALLOW_EXPECTED = [
    ("HR1 Temp evidence", f"python -m pytest tests/ -q {GT} Artifacts/Temp/x.txt 2{GT}&1"),
    ("HR1 Evidence dir", f"bash scripts/deploy.sh {GT} Artifacts/Evidence/IGH-1/d.txt 2{GT}&1"),
    ("HR1 source ext in Temp", f"python gen.py {GT} Artifacts/Temp/probe.py"),
    ("non-source target", f"python -m pytest -q {GT} results.txt"),
    ("arrow in commit msg", 'git commit -m "rename a.py -> b.py"'),
    ("dev null", f"ls {GT} /dev/null"),
    ("fd duplication only", "python -m pytest tests/ 2" + GT + "&1"),
    ("comparison operator", "python -c 'assert v >= 3'"),
    ("reading source", f"cat {SRC}"),
]


def verdict(command: str) -> str:
    payload = json.dumps({"tool_input": {"command": command}})
    result = subprocess.run(
        ["node", HOOK], input=payload, capture_output=True, text=True, timeout=10
    )
    if result.returncode != 0:
        return f"ERROR(exit={result.returncode})"
    return "DENY" if result.stdout.strip() else "ALLOW"


def run(title: str, cases, expected: str) -> list[tuple[str, str, str]]:
    print(f"\n--- {title} (expect {expected}) ---")
    rows = []
    for label, command in cases:
        got = verdict(command)
        flag = "ok " if got == expected else "!! "
        print(f"  {flag}{got:6} | {label:28} | {command}")
        rows.append((label, expected, got))
    return rows


print("=== IGH-1 T5 adversarial probe: DEPLOYED guard-commands.js ===")
print(f"hook: {HOOK}")

rows = []
rows += run("core redirect denies", DENY_EXPECTED, "DENY")
rows += run("traversal escape", TRAVERSAL, "DENY")
rows += run("out-of-scope write paths (guard is a speed bump, not a sandbox)", OUT_OF_SCOPE, "ALLOW")
rows += run("HR1 allowlist + false-positive controls", ALLOW_EXPECTED, "ALLOW")

mismatches = [r for r in rows if r[1] != r[2]]
print(f"\n=== SUMMARY: {len(rows)} cases, {len(mismatches)} deviating from expectation ===")
for label, exp, got in mismatches:
    print(f"  DEVIATION: {label} — expected {exp}, got {got}")
