#! python 3
"""Lane A-live one-off probe harness — TEMPLATE.

Runs a single probe script inside a live Rhino instance via `rhinocode` and gets its
output back. Use this instead of hand-rolling the flush/sentinel/poll dance for every
one-off probe; use `in_process_bridge_runner.py` + `in_process_suite_runner.py` instead
when you need a whole *pytest suite* folded into the host gate.

Why this exists (the two traps)
-------------------------------
`rhinocode script` fails in two ways that look identical to "the script did nothing":

  1. ASYNC RETURN — exit 0 means *dispatched*, not *finished*. An immediate read of the
     report races the script and returns an empty or truncated file.
  2. NO STDOUT — `print()` inside the probe never travels back to the CLI. The caller's
     redirect file is empty even on complete success.

Both are solved the same way: the probe's output is captured to a file IN-PROCESS and the
run ends with a terminal SENTINEL line; the host polls for that line before reading. Never
assert on rhinocode's return code.

The trap that bites hardest is the false fix: retrying "works", because a second dispatch
burns enough wall-clock for the FIRST one to finish writing. A retry that fixes it is
evidence of the race, not a workaround — and for a mutating probe it is dangerous (see
MUTATING below).

TEMPLATE: copy into your project's probes/ directory and fill the two `# TODO:` values.

Host-side poll (run this from the host, NOT inside Rhino)
--------------------------------------------------------
    import subprocess, time, os

    REPORT = r"<same absolute path as REPORT_PATH below>"
    SENTINEL = "[probe] END (harness status: "
    DEADLINE_S, POLL_S = 120.0, 1.0

    if os.path.exists(REPORT):
        os.remove(REPORT)                      # never read a stale report from a prior run

    subprocess.run([RHINOCODE, "-r", instance_id, "script", HARNESS_ABS_PATH],
                   capture_output=True, text=True, timeout=60)   # exit code is NOT the result

    deadline = time.time() + DEADLINE_S
    while time.time() < deadline:
        if os.path.exists(REPORT):
            body = open(REPORT, encoding="utf-8").read()
            if SENTINEL in body:
                print(body)                    # <- the real evidence; cite THIS path
                break
        time.sleep(POLL_S)
    else:
        raise AssertionError("no sentinel within %.0fs — probe hung or never dispatched"
                             % DEADLINE_S)
"""

import os
import sys
import traceback
from typing import Optional

import scriptcontext as sc  # noqa: F401  (live Rhino document context)

# --- TODO: fill in for your project --------------------------------------------------
PROBE_PATH = r"PATH/TO/probes/my_probe.py"                  # the probe, run UNMODIFIED
REPORT_PATH = r"PATH/TO/Artifacts/Temp/probe_report.txt"    # MUST match the host's REPORT
# -------------------------------------------------------------------------------------

SENTINEL = "[probe] END (harness status: "   # must match the host poller exactly

# Per-probe safety declaration. Tag EVERY probe, and keep the tag next to the probe
# itself — a probe whose blast radius is undeclared is treated as mutating.
#   "read-only" — inspects only. Safe to re-run.
#   "mutating"  — writes document objects, app settings, or plugin state. NOT re-runnable.
MUTATING = True

# Guards the wrong-document case. Matched case-insensitively as a substring of RhinoDoc.Name.
#
# REQUIRED when MUTATING is True — a mutating probe with no DOC_HINT aborts. The guard must
# fail CLOSED: if it defaulted to "allow" when unset, every mutating probe that forgot to set
# it would run unguarded against whatever document happened to be open, with no error. Only a
# probe that has declared itself read-only may leave this None.
DOC_HINT = None  # type: Optional[str]


def emit(handle, line):
    # type: (object, str) -> None
    """Write one line and flush immediately.

    Incremental flush is load-bearing: a probe that crashes mid-run must still leave the
    lines it already produced, or a real failure is indistinguishable from a no-op.
    """
    handle.write(line + "\n")
    handle.flush()


def _check_document(handle):
    # type: (object) -> bool
    """Abort a probe pointed at the wrong document. Fails CLOSED for mutating probes."""
    if DOC_HINT is None:
        if MUTATING:
            emit(handle, "[probe] ABORT — MUTATING probe declares no DOC_HINT. Set DOC_HINT to "
                         "a substring of the intended document name, or set MUTATING=False if "
                         "this probe really only reads.")
            return False
        emit(handle, "[probe] doc guard N/A — probe declares MUTATING=False, no DOC_HINT needed")
        return True
    name = sc.doc.Name or "<unsaved>"
    if DOC_HINT.lower() in name.lower():
        emit(handle, "[probe] doc guard OK — active doc %r matches hint %r" % (name, DOC_HINT))
        return True
    emit(handle, "[probe] ABORT — active doc %r does not match hint %r" % (name, DOC_HINT))
    return False


def main():
    # type: () -> int
    report_dir = os.path.dirname(REPORT_PATH)
    if report_dir and not os.path.isdir(report_dir):
        os.makedirs(report_dir)

    with open(REPORT_PATH, "w", encoding="utf-8") as handle:
        emit(handle, "[probe] BEGIN pid=%s" % os.getpid())
        emit(handle, "[probe] probe=%s" % PROBE_PATH)
        emit(handle, "[probe] mutating=%s" % MUTATING)
        emit(handle, "[probe] doc=%s" % (sc.doc.Name or "<unsaved>"))

        if not _check_document(handle):
            emit(handle, SENTINEL + "doc-guard-abort)")
            return 3

        if not os.path.isfile(PROBE_PATH):
            emit(handle, "[probe] ABORT — probe not found: %s" % PROBE_PATH)
            emit(handle, SENTINEL + "probe-missing)")
            return 4

        # The probe's print() output is captured here rather than left to the CLI, which
        # never receives it. The probe itself needs no modification to be harnessed.
        original_stdout = sys.stdout
        sys.stdout = handle
        status, rc = "ok", 0
        try:
            globals_ = {"__name__": "__main__", "__file__": PROBE_PATH}
            with open(PROBE_PATH, encoding="utf-8") as probe_file:
                source = probe_file.read()
            exec(compile(source, PROBE_PATH, "exec"), globals_)
        except SystemExit as exc:                      # a probe calling sys.exit() is not a crash
            rc = int(exc.code or 0)
            status = "ok" if rc == 0 else "probe-exit-%d" % rc
        except Exception:                              # noqa: BLE001 — must reach the report
            sys.stdout = original_stdout
            emit(handle, "[probe] TRACEBACK\n" + traceback.format_exc())
            status, rc = "probe-raised", 1
        finally:
            sys.stdout = original_stdout

        # The terminal line. Its presence is the ONLY valid signal that the run finished.
        emit(handle, SENTINEL + "%s) rc=%d" % (status, rc))
        return rc


if __name__ == "__main__":
    main()
