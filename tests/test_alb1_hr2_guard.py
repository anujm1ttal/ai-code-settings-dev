"""ALB-1 T1 -- HR2 guard (Plan Sec2 Hard Rule 2): the main-session-critical set stays
universal (always-loaded) through every relocation. One anchor string per item; this
test must PASS today and must keep passing after every later ALB-1 task -- a regression
here means a HARD-GATE/rule silently fell out of the always-loaded set.

"Always-loaded" = CLAUDE-global.md + every rules/**/*.md file WITHOUT `paths:` frontmatter
(same basis as test_alb1_budget.py).
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RULES_DIR = REPO_ROOT / "rules"
CLAUDE_GLOBAL = REPO_ROOT / "CLAUDE-global.md"

FM = re.compile(r"\A---\r?\n(.*?)\r?\n---", re.S)


def _has_paths(p: Path) -> bool:
    text = p.read_text(encoding="utf-8")
    m = FM.match(text)
    return bool(m and re.search(r"(?m)^paths\s*:", m.group(1)))


def _always_loaded_text() -> str:
    rules = sorted(RULES_DIR.rglob("*.md"))
    files = [CLAUDE_GLOBAL] + [r for r in rules if not _has_paths(r)]
    return "\n".join(f.read_text(encoding="utf-8") for f in files)


# One stable anchor per Plan Sec2 HR2 item.
HR2_ANCHORS = {
    "Step 0 HARD-GATE": (
        "No agent may begin implementation, write code, scaffold projects, or take any implementation"
    ),
    "Evidence is a file, not a claim": "Evidence is a file, not a claim [HARD-GATE]",
    "Scratch Strategy HARD-GATE": "Scratch Strategy [HARD-GATE]",
    "Evidence Retention HARD-GATE": "Evidence Retention [HARD-GATE]",
    "Artifacts persistence": "State lives in the project's own **Artifacts/** directory",
    "Windows Shell HARD-GATE": "Windows Shell & Paths [HARD-GATE]",
    "Approval Rubric": "## Approval Rubric",
    "Stop-and-surface triggers": "**Stop-and-surface triggers**",
    "Deny List incl. Co-Authored-By": "`Co-Authored-By: Claude` trailer",
    "TODO authority table": "## Artifacts/TODO.md Authority",
    "Verification Tiering": "## Verification Tiering (Orchestrator / Executor)",
    "Safety Guards principle": "## Safety Guards (CRITICAL)",
}


def test_hr2_main_session_critical_set_stays_universal() -> None:
    text = _always_loaded_text()
    missing = [name for name, anchor in HR2_ANCHORS.items() if anchor not in text]
    assert not missing, (
        f"HR2 violation: {missing} no longer found in the always-loaded set "
        "(CLAUDE-global.md + unconditional rules/**/*.md)"
    )
