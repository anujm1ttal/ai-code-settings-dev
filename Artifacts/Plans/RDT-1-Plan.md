# RDT-1 Plan — Lane A-live Doc-Targeting Guard

**Initiative:** RDT — Rhinocode Doc-Targeting (user-driven, out of OXL sequence)
**Branch:** `phase-rdt-1-rhinocode-doc-guard` · **Step 0 approved:** 2026-07-24
**Type:** geometry (settings-repo harness hardening) · **Origin:** user reported wrong-document
risk when multiple Rhino instances are open; `rhinocode script` with no explicit `-r` resolves
to an ambiguous instance.

## Premise corrections (live-probed 2026-07-24, Rhino 8.28)

The user's framing named a `-i` flag and a pinned PID. Both are wrong; the plan encodes reality:

1. **No `-i` flag exists.** `rhinocode --help` / `script --help` expose only `-r, --rhino <ID>`.
   The real defect is *omitting* `-r` (bare invocation → ambiguous instance). Rule is
   **"always `-r`, never bare"**, NOT "never `-i`".
2. **PIDs are volatile** — the user's `37092` was already stale; live was `31340`. Guard must
   resolve by **doc-hint**, never a pinned instance-id.
3. **Non-Rhino pipes appear in `list`.** `compute.geometry` publishes a `rhinocode_remotepipe_*`
   pipe with an empty `activeDoc`. The current `_INSTANCE_ID_RE.search()` (first regex match,
   order not guaranteed) can hand `-r` a compute.geometry pipe. Resolution MUST filter
   `processName == "Rhino"`.

Live `list --json` shape (the contract the parser codes against):
```json
[{"pipeId":"rhinocode_remotepipe_31340","processName":"Rhino",
  "activeDoc":{"title":"gBlox_P0_2_scratch.3dm","location":"C:\\...\\gBlox_P0_2_scratch.3dm"}},
 {"pipeId":"rhinocode_remotepipe_30536","processName":"compute.geometry",
  "activeDoc":{"title":"","location":""}}]
```

## Design decisions (user-approved)

| Decision | Choice |
|:---|:---|
| Ambiguity behavior | **Fail loud, never guess.** >1 live *Rhino* instance + no explicit target → assert with a diagnostic table (pipeId + activeDoc.title for each). Solo Rhino instance still auto-runs. |
| Doc-hint source | **`RHINO_DOC_HINT` env var.** Hard-assert for document-mutating probes; warn-only for read-only. |
| Instance override | **`RHINO_INSTANCE_ID` env var** — explicit escape hatch that skips discovery entirely. |
| Hint match | **`activeDoc.title`, substring, case-insensitive** (`gBlox_P0_2_scratch` ⊂ `gBlox_P0_2_scratch.3dm`). |
| Scope | 4 touch-points: bridge runner, suite runner, SKILL.md, pitfalls.md. No hook, no new skill/command/registry row. |

## Technical changes

### T1 — `resources/in_process_bridge_runner.py` (host-side)
Replace regex discovery with JSON discovery + fail-loud resolution.

- Drop `_INSTANCE_ID_RE`. Add `discover_rhino_instances() -> list[dict]`:
  `rhinocode list --json` → `json.loads` → keep only `processName == "Rhino"`.
- Add `resolve_instance() -> str`:
  1. If `RHINO_INSTANCE_ID` set → return it verbatim (explicit override, HR-respecting).
  2. Else discover Rhino instances.
     - 0 → assert `"no live Rhino instance (StartScriptServer run?)"`.
     - 1 → return its `pipeId`.
     - >1 → assert with a table: each `pipeId` + `activeDoc.title`, instructing the caller to
       set `RHINO_INSTANCE_ID`. **Never auto-pick.**
- Propagate `RHINO_DOC_HINT` into the subprocess `env` so the suite runner sees it.
- Keep `-r` flag (already correct), keep sentinel-poll (untouched).

### T2 — `resources/in_process_suite_runner.py` (in-Rhino)
Add a doc-hint guard at the very top of `_run()`, before pytest import / any work.

- Read `RHINO_DOC_HINT` from env.
- `import Rhino`; read `Rhino.RhinoDoc.ActiveDoc` title (guard `None`).
- Mutating default: if `RHINO_DOC_HINT` set and not a case-insensitive substring of the active
  doc title → `emit` diagnostic + `SENTINEL + "94"` (new abort code) + return. Runs nothing.
- Read-only opt-out: `RHINO_DOC_READONLY=1` downgrades mismatch to a warning line (still runs).
- If `RHINO_DOC_HINT` unset → warn-only line (`doc-hint guard: RHINO_DOC_HINT unset`), preserve
  current behavior so existing copies don't hard-break.

## Hard Rules (auditor rejects on violation)
1. No `rhinocode` invocation in any shipped resource omits `-r`.
2. Instance resolution filters `processName == "Rhino"` — no bare pipe-id regex match survives.
3. No pinned PID / instance-id literal in any template or doc example.

## Success metrics (RDT-1, code)
- `discover_rhino_instances()` returns only `processName == "Rhino"` entries (unit test with the
  2-element fixture above proves `compute.geometry` is filtered out).
- A ≥2-Rhino-instance fixture makes `resolve_instance()` raise `AssertionError` naming **both**
  `activeDoc.title`s. (single-instance fixture returns its pipeId; test proves both paths.)
- Zero regex-based instance resolution remains (`grep _INSTANCE_ID_RE` → 0).
- Suite runner emits `SENTINEL + "94"` and runs no pytest when `RHINO_DOC_HINT` mismatches.
- `python -m pytest tests/ -q` exit 0 (repo suite still green).

## Test lane
Lane B (pure) — `discover`/`resolve` parse `list --json` text and env vars; both are pure given
injected fixture strings. No live Rhino needed for the RDT-1 gate. Live doc-hint abort path is
Lane A-live, spot-verified manually against the running instance (evidence to `Artifacts/Temp/`).
