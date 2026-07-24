#! python 3
# venv: rhino_e2e_inprocess
# r: pytest
"""In-process Lane A suite runner — TEMPLATE.

Executes pytest INSIDE a live Rhino instance (real RhinoCommon, not a headless mock).
Invoked by the host-side bridge (in_process_bridge_runner.py) via:

    rhinocode -r <instance-id> script <ABSOLUTE PATH TO THIS FILE>

TEMPLATE: copy into your project (e.g. scripts/probes/<name>/), fill in the `# TODO:`
placeholders below, and set REPORT_PATH to match the bridge's REPORT_PATH byte-for-byte
— the bridge polls the exact file this script writes.

Why the header directives (`# venv:` / `# r:`)
------------------------------------------------
`rhinocode script` runs inside Rhino's embedded CPython (~3.9), which sees only stdlib +
live RhinoCommon — not your repo's host `.venv`. The `# venv: <name>` + `# r: <pkg>`
header directives tell RhinoCode to provision a py39-Rhino8-matched venv named `<name>`
and pip-install `<pkg>` into it on first run. This sidesteps the version trap of pointing
at a 3.11+ host venv (whose stdlib-promoted deps, e.g. `exceptiongroup`, are simply
absent for a 3.9 interpreter).

Why the sys.modules purge
--------------------------
RhinoCode reuses ONE embedded interpreter across every script run in a session. If an
earlier script in this session imported modules from your repo's host `.venv` (3.11+),
those modules stay cached in sys.modules and get reused here instead of the fresh py39
venv this script just provisioned — poisoning `import pytest` with a 3.11 build that
cannot run under 3.9. Purge every sys.modules entry whose `__file__` resolves under the
host `.venv` before importing pytest.

Why faulthandler is disabled
------------------------------
Rhino has no real stderr file descriptor (`sys.__stderr__` is None in this context), and
pytest's faulthandler plugin crashes at configure time trying to use it. Always pass
`-p no:faulthandler`.

Why exit-0-before-done matters here too
-----------------------------------------
rhinocode returns 0 before the script finishes — hence the sentinel poll; see the
rhino-e2e-testing skill (Lane A-live section) and in_process_bridge_runner.py's
docstring. This script's only job on every exit path is to guarantee a terminal
SENTINEL line lands in REPORT_PATH.
"""
import os
import sys
import traceback

# --- TODO: fill in for your project ------------------------------------------------
SUITE_PATH = "PATH/TO/tests_inprocess"                         # the real-RhinoCommon pytest suite
REPORT_PATH = "PATH/TO/Artifacts/Temp/inprocess_report.txt"    # MUST match the bridge's REPORT_PATH
HOST_VENV_DIR = "PATH/TO/.venv"                                # host repo's .venv, purged below
# -------------------------------------------------------------------------------------

SENTINEL = "[inprocess] complete rc="   # must match the bridge's SENTINEL constant exactly


def _run(report):
    def emit(msg):
        report.write(msg + "\n")
        report.flush()

    emit("[inprocess] runner start")
    emit("python " + sys.version.replace("\n", " "))

    # Doc-hint guard: refuse to run a document-mutating suite against the wrong open
    # document. Must happen before any real work (sys.modules purge, pytest import).
    hint = os.environ.get("RHINO_DOC_HINT")
    readonly = os.environ.get("RHINO_DOC_READONLY") == "1"
    try:
        import Rhino
        _active_doc = Rhino.RhinoDoc.ActiveDoc
        title = _active_doc.Name if _active_doc is not None else ""
    except Exception as exc:
        emit("RHINO IMPORT FAILED: %r" % exc)
        emit(SENTINEL + "98")
        return

    if not hint:
        emit("doc-hint guard: RHINO_DOC_HINT unset — skipping guard")
    elif hint.lower() in title.lower():
        emit("doc-hint guard: OK (ActiveDoc '%s' matches hint '%s')" % (title, hint))
    elif readonly:
        emit("doc-hint guard: WARNING mismatch expected '%s' in ActiveDoc '%s' — "
             "RHINO_DOC_READONLY=1, continuing" % (hint, title))
    else:
        emit("doc-hint guard: MISMATCH expected '%s' in ActiveDoc '%s' — ABORT" % (hint, title))
        emit(SENTINEL + "94")
        return

    # Purge every module cached from the host .venv so pytest and its plugins resolve
    # fresh from the RhinoCode-provisioned venv declared in the `# venv:`/`# r:` header.
    _host_venv = os.path.abspath(HOST_VENV_DIR).lower()
    for _name in list(sys.modules):
        _f = getattr(sys.modules.get(_name), "__file__", None)
        if _f and _host_venv in os.path.abspath(_f).lower():
            del sys.modules[_name]

    try:
        import pytest
        emit("pytest " + pytest.__version__)
    except Exception as exc:
        emit("PYTEST IMPORT FAILED: %r" % exc)
        emit(SENTINEL + "97")
        return

    try:
        import Rhino
        emit("RhinoCommon live: " + str(Rhino.RhinoApp.Version))
    except Exception as exc:
        emit("RHINO IMPORT FAILED: %r" % exc)
        emit(SENTINEL + "98")
        return

    junit_path = os.path.splitext(REPORT_PATH)[0] + "_junit.xml"
    # -p no:faulthandler: Rhino has no real stderr fileno; faulthandler crashes at configure.
    # junit-xml carries per-test detail the incremental report doesn't.
    try:
        rc = pytest.main(
            ["-p", "no:faulthandler", "-p", "no:cacheprovider",
             "--import-mode=importlib", "--junit-xml", junit_path,
             "--rootdir", SUITE_PATH, SUITE_PATH]
        )
    except Exception:
        emit("PYTEST RUN CRASHED:\n" + traceback.format_exc())
        emit(SENTINEL + "96")
        return

    try:
        import xml.etree.ElementTree as ET
        _root = ET.parse(junit_path).getroot()
        _ts = _root if _root.tag == "testsuite" else _root.find("testsuite")
        emit("[inprocess] junit tests=%s failures=%s errors=%s skipped=%s" % (
            _ts.get("tests"), _ts.get("failures"), _ts.get("errors"), _ts.get("skipped")))
    except Exception as exc:
        emit("junit summary unavailable: %r" % exc)

    emit("[inprocess] pytest rc=%d" % int(rc))
    emit(SENTINEL + str(int(rc)))


def main():
    report = open(REPORT_PATH, "w", encoding="utf-8")
    try:
        _run(report)
    finally:
        report.close()


try:
    main()
except Exception:
    # Last-ditch: never leave the caller (bridge) polling forever without a sentinel.
    with open(REPORT_PATH, "a", encoding="utf-8") as _f:
        _f.write("RUNNER FATAL:\n" + traceback.format_exc() + "\n")
        _f.write(SENTINEL + "95\n")
