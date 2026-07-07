# Skill Abstract: DAX & Power BI Modeling (L0)

**Purpose**: Star-schema data modeling and DAX measure authoring/optimization for Power BI.

**Core Logic**:
- **Star Schema Mandatory**: 1:Many Dim→Fact only, no Fact-to-Fact bridging; `Dim`/`Fact`/`Bridge` naming.
- **Safety**: `VAR/RETURN` on every measure; `DIVIDE(n, d, 0)` — never raw `/`.
- **Escalation**: Load `references/dax-patterns.md` before authoring, `optimization.md` when rows > 1M or slow.

**Constraint**: Do NOT use for visual/theme styling — route to `powerbi-report`.
