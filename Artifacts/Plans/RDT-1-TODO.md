# RDT-1 TODO — Lane A-live Doc-Targeting Guard

**Branch:** `phase-rdt-1-rhinocode-doc-guard` · Plan: `Artifacts/Plans/RDT-1-Plan.md`

## RDT-1 — Harden the harness
- [x] [coder] T1: JSON discovery + fail-loud resolution in `in_process_bridge_runner.py` — Success: `discover_rhino_instances()` filters `processName=="Rhino"`; `resolve_instance()` raises naming both docs on >1 instance, returns pipeId on 1, honors `RHINO_INSTANCE_ID`; `_INSTANCE_ID_RE` gone; propagates `RHINO_DOC_HINT` to subprocess env — Mode: AFK
- [x] [coder] T2: doc-hint guard in `in_process_suite_runner.py` — Success: pre-work assert on `ActiveDoc` title vs `RHINO_DOC_HINT`, `SENTINEL+"94"` on mismatch, warn-only when unset or `RHINO_DOC_READONLY=1` — Mode: AFK — Blocked by: T1
- [x] [coder] T3: Lane B tests for T1 resolution logic (2-instance fixture → raise; compute.geometry filtered; single → pipeId) — Success: `python -m pytest tests/ -q` exit 0 with new tests — Mode: AFK — Blocked by: T1

## RDT-2 — Codify the rule
- [x] [coder] T4: `rhino-e2e-testing/SKILL.md` Key Rule — "always `-r`, never bare"; doc-hint guard mandatory for mutating probes; resolve by `--json` + Rhino filter — Success: rule present, 0 phantom `-i` prohibition, no pinned PID example — Mode: AFK — **Re-audited 2026-07-24: HR1 fix verified clean (lines 122-127, 156 all `-r`-qualified or explicitly noted as not needing it; relative-path defect in the Evidence Protocol probe also fixed)**
- [x] [coder] T5: `python-rhino-grasshopper/references/pitfalls.md` row — bare `rhinocode` / first-match instance resolution → wrong-document execution — Success: 1 new row pointing to rhino-e2e-testing for the guard — Mode: AFK — Blocked by: T4

## Gate
- [ ] [auditor] T6: verify HR1–HR3, all success metrics, `bash scripts/deploy.sh` exit 0 — Success: AUDIT_REPORT GO + deploy 6-step pass — Mode: HITL — Blocked by: T2, T3, T5
