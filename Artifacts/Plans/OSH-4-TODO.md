# Phase OSH-4: Registry Reconciliation & Skill Hygiene — Tasks

See `Artifacts/Plans/OSH-4-Plan.md` (§Technical Approach decisions are binding). Findings: CM/RU/SK/AG per plan tables.

## Tasks

### A — Registries
- [x] [coder] Create branch `phase-osh-4-registry-skills` — Success: no work on main
- [x] [coder] CLAUDE-global.md: +geometry-validator row; /deck owner; foundational-skills +TDD +receiving-code-review; +pptx-slide-design; docx/xlsx mention; remove dup /learn row (AG-12, CM-5, SK-12) — Success: registry names only on-disk entities
- [x] [coder] orchestration.md: +geometry-validator fleet row; +8 missing command rows; /grill note (RU-F6, CM-2, RU-F8) — Success: 22/22 commands listed
- [x] [coder] model-routing.md YAML: +geometry-validator (AG-12) — Success: 8 bindings
- [x] [coder] skills.overview.md: ghost plugin names; geometry pointer; skill-creator → plugin pointer; +business-analyst; counts (SK-3, SK-4, SK-11, SK-9) — Success: grep ms-office-core = 0

### B — Plugins & skills
- [x] [coder] DELETE 17 METADATA.yaml; ADD version to 7 plugin.json; manuscript description fix + marketplace mirror (SK-2, SK-14, SK-10) — Success: Glob METADATA.yaml = 0; JSON all parse
- [x] [coder] `git mv` business-analyst → skills/; drop from manuscript plugin.json skills list (SK-9) — Success: plugin has 1 skill; core has business-analyst
- [x] [scribe] Rewrite business-analyst + manuscript-review descriptions (house pattern; nothing dropped) (SK-13) — Success: both have Use/Trigger/Do-NOT
- [x] [coder] python-patterns 3.9 fix (SK-1) — Success: description matches runtime matrix
- [x] [coder] DELETE skills/skill-creator/ (SK-11, SK-15) — Success: single source (plugin)
- [x] [coder] project-planner: heading rename + rule-echo → pointers (SK-6, SK-7) — Success: unique headings; no ROI/Interface-First restatement
- [x] [scribe] codebase-navigator + glossary-extraction Do-NOT boundaries (SK-17) — Success: boundaries appended
- [x] [coder] pptx-slide-design path fix; +model: to 3 override skills; non-spec keys → metadata:, delete auto_activate (SK-16, SK-18, SK-19) — Success: greps clean
- [x] [coder] TOKEN-ECONOMICS: L0 mandatory only >150-line skills (SK-5) — Success: rule amended
- [x] [scribe] Write 6 abstracts (dax-modeling, python-patterns, doc-updater, rhino-e2e-testing, pptx-slide-design, powerbi-report) (SK-5) — Success: each ≤300 tokens, mirrors house abstract style
- [x] [coder] testing-strategy ↔ TDD-skill boundary pass (lanes/evidence vs loop; pointers both ways) (SK-8) — Success: TDD loop stated once

### C — Commands
- [x] [coder] $ARGUMENTS anchors ×13; allowed-tools for read-only; model: ×22 (CM-9, CM-10) — Success: frontmatter matrix per plan
- [x] [coder] skill-graph.md: plugin scan + approval fix + trim (CM-13, CM-28) — Success: both roots scanned
- [x] [coder] graduate.md destination; blueprint.md Phase-N creation + grill gate; sync.md HOT.md fallback + learn.md bootstrap + enum labels; clean.md confirm flow; owner strings; handoff.md IsArtifact; council.md fallback; header style ×3 (CM-14, 16, 17, 18, 21, 22, 23, 24, 26, 27) — Success: each verified per plan row
- [x] [auditor] Run `/registry-audit` as phase gate — Success: zero broken refs, fresh evidence
- [x] [coder] Deploy — Success: validation passes (`Artifacts/Temp/osh-4_deploy.txt`, 6/6 steps)
- [x] [auditor] Verify hard rules (no description weakening; deletions enumerated only); mark `[x]` — Success: PASS (see `Artifacts/AUDIT_REPORT.md` OSH-4 Final Sign-Off gate)

## Status

- [x] Strategist approval (Step 0 — user accepted 2026-07-07)
- [x] Git branch created (`phase-osh-4-registry-skills`, 2026-07-07)
- [x] Implementation complete
- [x] Auditor verification complete
