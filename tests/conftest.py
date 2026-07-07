"""Shared pytest fixtures/path setup for the ai-code-settings test suite.

`scripts/` is a flat collection of standalone tools, not an installed package,
so it needs to be on `sys.path` before its modules can be imported by name.
"""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = REPO_ROOT / "scripts"

if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))
