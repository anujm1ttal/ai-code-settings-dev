# Skill Abstract: High-Rigor Engineering Workflow (L0)

**Purpose**: Synchronous, evidence-first variant of standard orchestration for geometry
validation, production deploys, regulatory compliance, or anything with zero-rework tolerance.

**Core Logic**:
- **Evidence protocol**: Every claim-supporting command output redirects to
  `Artifacts/Temp/<phase>_<step>_<command>.txt` — no pasted summaries. Cited evidence is
  promoted to `Artifacts/Evidence/<phase>/` and committed before any cleanup.
- **Gate cadence**: One plan step per response; explicit approval only (never inferred).
  Commit requires the exact phrase `approved, proceed with commit`.
- **Patch protocol**: Audit → Propose (real `git diff`) → Approve → Apply → Verify.
- **Scope lockdown**: Explicit approved file list; halt-immediately on any out-of-scope edit.
- **Anti-patterns taxonomy**: Named violations (Ship-and-defer, Summary-substitution,
  Synthetic-diff, Quiet-staging, etc.) — halt and surface by name on sight.

**Precedence**: Overrides `orchestration.md` on commit cadence and approval phrases where
they conflict; defers to it everywhere else.

**Owners**: coder (execution), auditor (gate verification), strategist (declares mode).
