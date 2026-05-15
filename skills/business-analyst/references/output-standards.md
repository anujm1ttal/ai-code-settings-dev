# Business Analysis Output Standards

## Business Requirements Document (Artifacts/BRD_SUMMARY.md)

When triggered, generate a `Artifacts/BRD_SUMMARY.md` with the following structure:

### THE VALUE PROPOSITION
- Single sentence on why this project is a priority for the organization.
- Quantified impact: dollars saved, time recovered, risk mitigated.

### STAKEHOLDER MAP
| Role | Name / Team | Influence | Needs |
| :--- | :--- | :--- | :--- |
| Owner | [who] | [high/medium/low] | [what they need from this project] |
| User | [who] | [high/medium/low] | [what they need from the tool] |
| Beneficiary | [who] | [high/medium/low] | [what they gain downstream] |
| Blocker | [who] | [high/medium/low] | [what concern must be addressed] |

### CRITICAL REQUIREMENTS
- **Must Have**: Top 3 functional requirements that define a successful delivery.
- **Should Have**: 2–3 enhancements that significantly increase value.
- **Won't Have**: Explicitly scoped-out items to prevent scope creep.

### ROI PROJECTION
| Factor | Estimate |
| :--- | :--- |
| Build effort | [hours/days/phases] |
| Operational time saved | [per use / per season] |
| Revenue impact | [if applicable] |
| Risk reduction | [compliance / safety] |
| Payback period | [when ROI turns positive] |

### RISKS & MITIGATIONS
| Risk | Likelihood | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| [risk] | [H/M/L] | [H/M/L] | [strategy] |

### OPERATIONAL FIT
- Current workflow insertion point.
- Required data sources and access status.
- Training and adoption plan.
- Fallback procedure if the tool is unavailable.

## Completion Metrics (Strategist Validation)

The `strategist` evaluates these before proceeding to `/blueprint`:

| Metric | Rating | Criteria |
| :--- | :--- | :--- |
| **Requirement Clarity** | High / Ambiguous / Lacking | Are all Must-Have requirements testable? |
| **Operational Fit** | Seamless / Friction-Heavy / Requires Process Change | Does it slot into existing workflows? |
| **Data Readiness** | Ready / Partial / Unavailable | Is the required data accessible and clean? |
| **Adoption Likelihood** | High / Medium / Low | Will users actually use this? |
| **ROI Confidence** | Strong / Moderate / Speculative | Is the value projection based on evidence or assumption? |
