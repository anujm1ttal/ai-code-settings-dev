---
name: windows-pytest-launcher
description: On Windows, pytest.exe launcher fails on subprocess-spawning tests; use `python -m pytest` in automated contexts
metadata:
  type: anti-patterns
  contexts: [deploy, CI, testing]
  severity: HIGH
---

# Windows pytest Launcher Quirk

**Symptom**: Running `pytest tests/` on Windows intermittently fails with `OSError: [WinError 6] The handle is invalid` on subprocess-spawning test code, even though `python -m pytest tests/` passes all 105 tests identically.

**Root Cause**: The pytest.exe launcher has issues with handle inheritance in subprocess Popen calls on Windows. The same test collection, same assertions, same code — only the entry point differs.

**Solution**: Always invoke pytest via `python -m pytest` in automated contexts (deploy.sh, CI runners). The module invocation bypasses the launcher's quirks.

**Evidence**: Deployed LH-3 via `scripts/deploy.sh` (commit `2cee6eb`):
- First run used `pytest "$SOURCE/tests/" --tb=short` → 3 spurious WinError 6 failures (test_deploy_guard.py, test_gate_log.py×2)
- Fixed to `python -m pytest "$SOURCE/tests/" --tb=short` → 105/105 passed exit 0
- Reproduced both behaviors twice; handle-inheritance errors identical signature both times

**Fix**: Line 61 in `scripts/deploy.sh`, changed from bare `pytest` to `python -m pytest`.

**Gotcha**: This manifests only on subprocess-spawning tests (tests that spawn `node`, `subprocess.run`, etc.). Pure Python unit tests pass either way. If a test mysteriously fails only in deploy but passes locally, check whether it spawns subprocesses and the invocation method.
