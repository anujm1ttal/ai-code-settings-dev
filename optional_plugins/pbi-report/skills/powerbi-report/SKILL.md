---
name: powerbi-report
description: Use this skill whenever you are designing, building, or auditing Power BI report front-ends, including page layouts, visual selection, and theme JSON files. It mandates a theme-driven approach, mobile-first design, and strict performance limits (max 8 visuals per page). Trigger when the creative-director is drafting a LAYOUT_SPEC.md, when a coder is modifying a .pbip file, or when an auditor is performing a performance check. Do NOT use for backend data modeling or DAX calculations unless they directly impact visual rendering; use dax-modeling for those tasks.
argument-hint: "<page layout requirement or visual type selection>"
metadata:
  version: "1.1.0"
  tags: ["powerbi", "visualization", "dashboard", "reporting", "metrics"]
  globs: ["*.pbip", "*.Report/**", "theme*.json", "Artifacts/LAYOUT_SPEC.md"]
  verbosity_control: "TECHNICAL. Prioritize JSON blocks and tables over prose. Bullet-driven rules."
---


# Skill: Power BI Report Patterns

## 📥 Deep-Load Protocol
Load reference files ONLY when the specific implementation task requires detailed specs:

| File | Load When |
|:---|:---|
| `references/theme-defaults.json` | When generating or auditing a Power BI theme file. |
| `references/visual-library.md` | When selecting a visual type or verifying chart rules. |
| `references/layout-patterns.md` | When designing page archetypes or snapping to the grid. |
| `references/visual-formatting.md` | When configuring titles, numbers, or interactions. |
| `references/mobile-performance.md` | When designing mobile layouts or optimizing query speed. |
| `references/wireframe-examples.md` | When generating wireframes for `LAYOUT_SPEC.md`. |

---

## 📐 Core Principles
- **Theme-Driven**: All styling flows from a theme JSON file. No ad hoc formatting.
- **Audience-First**: Every page answers a specific question. No "just in case" visuals.
- **Density Discipline**: Target 3–7 pages per report. Max 8 visuals per page. More than 8 → add drill-through.
- **Mobile Is Not Optional**: Every report gets an explicit mobile layout.
- **Measure Over Column**: Visuals reference measures, not raw columns.
- **Consistency**: Repeating page archetypes across the report.

## 🚫 Anti-Patterns (Explicit Deny List)
- No ad hoc colors — all colors from theme JSON.
- No auto-generated mobile layouts — design manually.
- No pie charts with >5 slices.
- No dual-axis charts — use two visuals.
- No 3D visuals of any kind.
- No gauge visuals — use cards with conditional formatting.
- No >8 visuals per page.
- No raw columns in visual values — use measures.
- No default filter pane visible in published reports.
- No pages without a defined purpose in `Artifacts/LAYOUT_SPEC.md`.
- No unsorted bar charts — always sort by value descending.

## 🔍 Audit Checklist
Used by Auditor agent (`pbi-report` domain) to verify compliance:

- [ ] Theme JSON applied — no manual color overrides.
- [ ] ≤8 visuals per page.
- [ ] Mobile layout manually created for all pages.
- [ ] All visuals use measures, not raw columns.
- [ ] Visual interactions explicitly configured (not default).
- [ ] Default filter pane hidden.
- [ ] All visual titles are descriptive (insight, not chart type).
- [ ] Contrast ratios meet accessibility minimums.
- [ ] Conditional formatting limited to 2 visuals per page max.
- [ ] Performance Analyzer: no visual >2s render.

## 🔗 Relationships
- **Consumed by**: Creative Director (page layout), Auditor (compliance), Coder (theme/PBIP).
- **Depends on**: `dax-modeling` (measures), `visual-composition` (hierarchy).
- **Layout plans**: `Artifacts/LAYOUT_SPEC.md` governs page composition. **The Creative Director MUST include ASCII wireframes in the `Artifacts/LAYOUT_SPEC.md` based on `references/wireframe-examples.md`.**

## 🔨 Toolchain
- **Format**: PBIP (Power BI Project) for source control.
- **Theme**: Single theme JSON per project.
- **External Tools**: Tabular Editor (model), DAX Studio (tuning).
- **CI/CD**: pbi-tools for extraction/deployment.
